# App Android (APK)

O app Android é uma **Trusted Web Activity (TWA)**: abre
`https://gz-1-ingressos.vercel.app/abrir` em tela cheia usando o Chrome do
aparelho. Tudo o que muda no site aparece no app sem precisar de novo APK.

- Pacote: `br.com.gz1ingressos.app`
- Página inicial: `/abrir` (`app/pages/abrir.vue`) manda portaria para
  `/portaria`, administrador para `/` e quem não está logado para `/login`.
- Notificações: o Web Push do site é entregue como notificação do app
  (`DelegationService` do androidbrowserhelper). Não usa Firebase.
- Barra de endereço escondida: depende de
  `public/.well-known/assetlinks.json` ter a impressão digital (SHA-256) do
  certificado que assinou o APK.
- Download: `public/download/gz1-ingressos.apk`, servido em
  `https://gz-1-ingressos.vercel.app/download/gz1-ingressos.apk`.

## Gerar um novo APK

Só é preciso quando muda algo do app em si (nome, ícone, cores, URL inicial).

1. Aumente `appVersionCode` (e `appVersionName`) em `android/app/build.gradle`
   e faça push. O workflow `.github/workflows/android.yml` compila o APK sem
   assinatura e publica na pre-release `android-unsigned`.
2. Baixe e assine com a chave do app:

   ```sh
   curl -L -o /tmp/unsigned.apk \
     https://github.com/euthiagosilveira-hue/GZ1Ingressos/releases/download/android-unsigned/gz1-ingressos-unsigned.apk
   python3 android/tools/assinar_apk.py /tmp/unsigned.apk \
     public/download/gz1-ingressos.apk gz1-release.keystore "<senha>"
   ```

3. Faça commit de `public/download/gz1-ingressos.apk`. O job `verify` do
   workflow confere a assinatura com o `apksigner` oficial e compara o
   certificado com o `assetlinks.json`.

## Chave de assinatura

A chave (`gz1-release.keystore`, PKCS12, alias `gz1`) **não fica no
repositório** (ele é público). Ela está guardada nos arquivos do projeto do
Claude, em `android/`, junto com a senha. Sem ela não dá para publicar
atualizações: um APK assinado com outra chave não instala por cima do atual.
