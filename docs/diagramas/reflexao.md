# Reflexão final

> Qual dos dois diagramas foi mais útil para compreender ou questionar uma decisão do projeto? Por 
quê?

O **diagrama de sequência** foi o mais útil, porque foi o que fez o grupo questionar a decisão D3 — e 
entender por que ela tem duas partes.

Na versão da IA, a recusa da segunda ONG vinha do `UPDATE` no banco, e a verificação feita em
`doacoes.js` não aparecia. Lido assim, o código parecia ter uma verificação redundante: se o banco já
recusa, por que a aplicação confere o status antes?

Para corrigir o diagrama, foi preciso separar dois cenários. No caso comum, a segunda ONG chega
depois da primeira, e quem a barra é a verificação da aplicação — que é também quem sabe dizer o
motivo da recusa. Só quando as duas ONGs leem a doação disponível ao mesmo tempo é que a condição do
`UPDATE` faz diferença, e ela é a única coisa que garante que só uma fique com a doação. Desenhar
esse segundo caso com o fragmento `par` deixou claro que as duas verificações não se repetem: uma
explica a recusa e a outra garante a regra.

O diagrama de estados também ajudou, por outro caminho: ao conferir cada estado com a coluna `status`
do banco, ficou evidente que "vencida" não é um estado, e sim uma condição calculada pela data — a
mesma ideia que o relatório semanal da H6b usa para contar as doações vencidas.
