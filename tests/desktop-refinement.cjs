const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await page.route("**/*", (r) =>
      new URL(r.request().url()).hostname === "127.0.0.1"
        ? r.continue()
        : r.abort(),
    );
    await page.goto("http://127.0.0.1:5173");
    await page.getByRole("textbox", { name: /Mensagem para/ }).waitFor();
    await page
      .getByRole("status", { name: "Inicializando cbsHUB" })
      .waitFor({ state: "hidden" });
    await page
      .getByRole("button", { name: "Configurações do perfil", exact: true })
      .click();
    await page
      .getByRole("tab", { name: "Perfil & Identidade", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Nome de exibição", exact: true })
      .fill("Perfil integrado");
    assert.equal(await page.getByRole("dialog").count(), 1);
    await page
      .getByRole("button", { name: "Salvar perfil", exact: true })
      .click();
    assert.equal(await page.getByRole("dialog").count(), 1);
    await page
      .getByRole("tablist", { name: "Seções das configurações" })
      .getByRole("tab", { name: "Aparência", exact: true })
      .click();
    for (const name of [
      "Clássico",
      "Moderno Roxo",
      "Sakura Dream",
      "Velvet Nocturne",
    ]) {
      await page.getByRole("button", { name, exact: true }).click();
      await page
        .getByRole("button", { name: `Prévia ${name}`, exact: true })
        .waitFor();
      const checks = await page.evaluate(async () => {
        const { contrastChecks, PRESETS } = await import(
          "/src/studio/theme.ts"
        );
        const stored = JSON.parse(
          localStorage.getItem("cbshub-studio-v1"),
        ).active;
        return {
          name: stored.name,
          checks: contrastChecks(PRESETS.find((p) => p.name === stored.name)),
          bg: getComputedStyle(document.documentElement)
            .getPropertyValue("--background")
            .trim(),
        };
      });
      assert.equal(checks.name, name);
      if (["Sakura Dream", "Velvet Nocturne"].includes(name))
        assert(
          checks.checks.every((c) => c.ratio >= 4.5),
          JSON.stringify(checks),
        );
      assert.equal(await page.getByRole("dialog").count(), 1);
      await page.screenshot({
        path: `/workspace/cbshub-onboarding/refinement-${name.replaceAll(" ", "-")}.png`,
      });
    }
    await page.getByRole("button", { name: "Concluído", exact: true }).click();
    await page.reload();
    await page
      .getByRole("button", { name: "Configurações do perfil", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Velvet Nocturne", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("cbshub-studio-v1")).active.name,
      ),
      "Velvet Nocturne",
    );
    await page.keyboard.press("Escape");
    await page.evaluate(async () => {
      window.e = (await import("/src/lib/webrtcEngine.ts")).webrtcEngine;
      window.s = (await import("/src/store/useHubStore.ts")).useHubStore;
      window.m = (await import("/src/lib/mediaState.ts")).useMediaState;
    });
    await page.waitForFunction(() => !!e.localPeer);
    await page.evaluate(async () => {
      e.cancelRecovery();
      await e.joinVoiceCall();
      const local = Object.values(s.getState().participants).find(
        (p) => p.isLocal,
      );
      window.local = local;
      const remote = {
        ...local,
        peerId: "test-remote",
        clientId: "remote-client",
        isLocal: false,
        nickname: "Outro participante",
      };
      s.getState().setParticipants({
        [local.peerId]: local,
        [remote.peerId]: remote,
      });
      s.getState().setCallStageMode("grid");
      m.setState({
        quality: {
          "test-remote": {
            state: "connected",
            rttMs: 22,
            loss: 0,
            jitterMs: 1,
          },
        },
      });
    });
    let previous = 0;
    for (const height of [220, 360, 490]) {
      await page.evaluate((h) => s.getState().setCallStageHeight(h), height);
      await page.waitForTimeout(80);
      const bounds = await page
        .locator(".call-responsive-grid")
        .evaluate((el) => ({
          height: el.getBoundingClientRect().height,
          card: el.querySelector("[data-call-card]").getBoundingClientRect()
            .height,
          width: el.getBoundingClientRect().width,
          container: el.parentElement.getBoundingClientRect().width,
        }));
      assert(bounds.card > previous, JSON.stringify(bounds));
      previous = bounds.card;
      assert(bounds.width <= bounds.container);
    }
    assert.equal(
      await page
        .locator('[data-call-card="test-remote"]')
        .getByText("22 ms · 0% perda", { exact: true })
        .count(),
      1,
    );
    assert.equal(
      await page
        .locator(
          `[data-call-card="${await page.evaluate(() => local.peerId)}"]`,
        )
        .getByText(/22 ms/)
        .count(),
      0,
    );
    await page.evaluate(() => {
      m.setState({ signaling: "online", reconnecting: false });
      s.setState({ isConnected: true });
    });
    await page.waitForTimeout(50);
    await page.evaluate(() => {
      m.setState({
        signaling: "offline",
        reconnecting: true,
        recoveryAttempt: 2,
      });
      s.setState({ isConnected: false });
    });
    await page.waitForTimeout(2700);
    assert.equal(
      await page.getByLabel("Reconectando à sala", { exact: true }).count(),
      0,
      "healthy voice must not be blocked by signaling loss",
    );
    await page.evaluate(() => m.setState({ quality: {} }));
    await page.getByLabel("Reconectando à sala", { exact: true }).waitFor();
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".animated-official-logo")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    await page
      .getByRole("button", {
        name: "Continuar no histórico local",
        exact: true,
      })
      .click();
    await page
      .getByLabel("Reconectando à sala", { exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(await page.evaluate(() => e.rawMicStream.active), true);
    await page.evaluate(() => {
      e.leaveVoiceCall();
      e.leaveRoom();
    });
    console.log(
      "PASS integrated single settings dialog/profile/theme persistence, four themes/new contrast checks, responsive call cards in three stage sizes, peer-scoped quality, controlled reconnect screen/cancel/reduced motion. No remote transport tested.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
