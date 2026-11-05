# Versionamento

Não foi encontrada política formal de releases anterior; o pacote estava em 1.0.0 enquanto a interface/documentos denominavam o produto v2.0. Esta fase estabelece identificação SemVer para revisão: **2.0.0-rc.1**, alinhada ao conjunto v2 e explicitamente pré-lançamento.

- `major.minor.patch` identifica releases; `-rc.N` identifica candidatos incrementais de revisão.
- `package.json` e o registro raiz de `package-lock.json` devem concordar, sem atualizar dependências para mudar apenas a versão.
- Criar um candidato não autoriza publicar release, tag estável ou modificar main.
- A versão 2.0.0 estável depende da matriz física, avaliação de segurança/dependências, revisão e autorização do mantenedor.
- Novas correções no candidato recebem rc.2 etc. Não reutilizar um artefato já distribuído sob o mesmo identificador de release.
