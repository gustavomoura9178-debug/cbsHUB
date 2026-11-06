# Versionamento

Não foi encontrada política formal de releases anterior; o pacote estava em 1.0.0 enquanto a interface/documentos denominavam o produto v2.0. Esta fase estabelece identificação SemVer para revisão: **2.0.0-rc.1**, alinhada ao conjunto v2 e explicitamente pré-lançamento.

- `major.minor.patch` identifica releases; `-rc.N` identifica candidatos incrementais de revisão.
- `package.json` e o registro raiz de `package-lock.json` devem concordar, sem atualizar dependências para mudar apenas a versão.
- Criar um candidato não autoriza publicar release, tag estável ou modificar main.
- A versão 2.0.0 estável depende da matriz física, avaliação de segurança/dependências, revisão e autorização do mantenedor.
- Novas correções no candidato recebem rc.2 etc. Não reutilizar um artefato já distribuído sob o mesmo identificador de release.

SECURITY-002 identifica o próximo candidato como **2.0.0-rc.2**. rc.1 permanece histórico, sem reutilização do identificador de artefato. Versão estável ainda depende dos gates de release.


DESKTOP-004 identifica o candidato de revisão **2.0.0-rc.3**, com package.json/raiz do lock consistentes e nenhuma mudança de dependências. A direção de produto “3.0” não equivale a uma release 3.0.0 validada. Nenhum artefato anterior é promovido como estável; distribuição depende dos gates físicos e de revisão.

HOTFIX-005 identifica o candidato de revisão **2.0.0-rc.4**. Package e entrada raiz do lock mudam apenas o identificador, sem resolver/atualizar dependências. Nenhuma promoção automática para estável, merge ou publicação de instalador. A denominação de produto 3.0 não altera esta política.

HOTFIX-006 identifica o candidato **2.0.0-rc.5** para não reutilizar rc.4 com conteúdo novo. Nenhuma dependência ou lock de resolução mudou; somente versão raiz. Distribuição estável continua sujeita aos gates manuais/revisão.
