# 2026-11-01 公開・インストール表示の修復

利用者の公開指示に基づき、既存のGitHub Pages公開元 `gh-pages:/` へ、修復済みWeb/PWAと今回の表示修正を公開する。ソースの作業ブランチは `codex/android-v14-roundtrip-20261030` を継続し、mainへmergeしない。

ブラウザーの「次回からすぐ開くために」欄の右上に、全39言語で既存の「閉じる」をアクセシブル名とする×を追加。閉じた設定を軽量UI preferenceへ保存し、次回の表示でも保持する。教材・媒体・ID・revisionは変更しない。インストール済みの初期表示、appinstalled通知、standaloneへの表示切替では、案内欄・インストールボタン・インストール手順を表示しない。青い「追加済み」ボタンは描画しない。

今回の変更後に `npm run verify` が合格。新しい翻訳キー・データ形式・機能は追加していない。アプリ本体は `assets/index-DvS-bhPK.js`、CSSは `assets/index-CAqp0v4y.css`。以前の39言語の意味審査、Importの一体保存、競合、Android往復の有効な証拠を引き継ぎ、無変更の試験は繰り返していない。

隔離headless Chromeで、ブラウザー39言語の×の位置・クリック・保存データ不変、キー操作と再読込後の非表示保持を確認した。さらに固有localhost originに実際にPWAをインストールし、実standaloneウィンドウの初期表示、39言語の切替、offline再読込で案内とインストールボタンがないことを確認。テスト登録はuninstallし、専用browser/serverを終了した。利用者の実profileと起動中の5185のserverは操作していない。

補助QA初回のtoolbar数検査には期待値9／実際8という試験側の誤りがあった。初回のブラウザー39言語・実インストール初期表示の有効なassertionを保持し、期待値を修正して残りのinstalled条件を追試した。raw FAILをPASSへ転記していない。原本は `first-attempt-expectation-error.json`、追試は `install-ui-result.json`。

証拠保存先：`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\.gradle-session\web-pwa-39-20261031T141213Z\install-ui-publish-20261101`

Androidの「PC入力」dialog／guideは共通の `windows_app_url` から `https://tom05251.github.io/growtree/download.html` を案内し、同ページのWebアプリリンクは正しい。署名済みuserRelease versionCode14 AABのSHA256は `8675474db4527b5058e3c3474913872106e4b71360dcce26f5247a24f37510de` を保持している。関連するこの案内HTMLだけを整備し、日本語の起動・任意インストール・保存・ZIP受け渡し手順と、実装に一致する更新説明を追加する。Androidの再Build・Playアップロードはしない。

公開先：<https://tom05251.github.io/flashcards-pc-input/>

公開commit・配信hash・公開後の実確認結果は、公開完了後に本記録へ追記する。OS標準の保存先ダイアログ選択・物理出音/Bluetooth等の既存未検証条件は引き続き区別する。
