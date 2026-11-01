# 2026-11-01 公開・インストール表示の修復

利用者の公開指示に基づき、既存のGitHub Pages公開元 `gh-pages:/` へ、修復済みWeb/PWAと今回の表示修正を公開する。ソースの作業ブランチは `codex/android-v14-roundtrip-20261030` を継続し、mainへmergeしない。

ブラウザーの「次回からすぐ開くために」欄の右上に、全39言語で既存の「閉じる」をアクセシブル名とする×を追加。閉じた設定を軽量UI preferenceへ保存し、次回の表示でも保持する。教材・媒体・ID・revisionは変更しない。インストール済みの初期表示、appinstalled通知、standaloneへの表示切替では、案内欄・インストールボタン・インストール手順を表示しない。青い「追加済み」ボタンは描画しない。

今回の変更後に `npm run verify` が合格。新しい翻訳キー・データ形式・機能は追加していない。アプリ本体は `assets/index-DvS-bhPK.js`、CSSは `assets/index-CAqp0v4y.css`。以前の39言語の意味審査、Importの一体保存、競合、Android往復の有効な証拠を引き継ぎ、無変更の試験は繰り返していない。

隔離headless Chromeで、ブラウザー39言語の×の位置・クリック・保存データ不変、キー操作と再読込後の非表示保持を確認した。さらに固有localhost originに実際にPWAをインストールし、実standaloneウィンドウの初期表示、39言語の切替、offline再読込で案内とインストールボタンがないことを確認。テスト登録はuninstallし、専用browser/serverを終了した。利用者の実profileと起動中の5185のserverは操作していない。

補助QA初回のtoolbar数検査には期待値9／実際8という試験側の誤りがあった。初回のブラウザー39言語・実インストール初期表示の有効なassertionを保持し、期待値を修正して残りのinstalled条件を追試した。raw FAILをPASSへ転記していない。原本は `first-attempt-expectation-error.json`、追試は `install-ui-result.json`。

証拠保存先：`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\.gradle-session\web-pwa-39-20261031T141213Z\install-ui-publish-20261101`

Androidの「PC入力」dialog／guideは共通の `windows_app_url` から `https://tom05251.github.io/growtree/download.html` を案内し、同ページのWebアプリリンクは正しい。署名済みuserRelease versionCode14 AABのSHA256は `8675474db4527b5058e3c3474913872106e4b71360dcce26f5247a24f37510de` を保持している。関連するこの案内HTMLだけを整備し、日本語の起動・任意インストール・保存・ZIP受け渡し手順と、実装に一致する更新説明を追加する。Androidの再Build・Playアップロードはしない。

公開先：<https://tom05251.github.io/flashcards-pc-input/>

公開完了。Web本体の公開commitは `553ddf4c38f22a856bc526a52aca9184e244d70d`、製品ソースcommitは `afae3acabb1a7e6823e0c27622e4e041efca6f1e`。案内ページ `Tom05251/growtree` の公開commitは `eb5a61eccd59d9abadfe81de5d116332a8e2bdef`。両方のPages buildがbuiltになったことをAPIで確認した。Web本体のmainは `468cb24a89b16a0b307031e3187e3fc55c174e86` のまま保持している。

公開HTTPから取得した51ファイルと検証済みdist／Git blobのSHA256はすべて一致。Windowsの改行変換で差が出たSVG2件は、配信ブランチだけのgitattributesで検証済みのバイトへ合わせた。旧hashのassetは稼働中の旧client用に保持している。

実際の公開案内ページの日本語ボタンから新版へ移動し、カード・Hint1／Hint2の保存、×、再読込後の非表示保持とDB不変を確認した。公開smokeの初回末尾には、`?lang=ja` が付いたURLのreload後にもARを期待する試験側の誤りがあった。明示JA指定の優先は正常な既存仕様。そこまでの4件の機能assertionと51ファイル照合を保持し、残るRTL／offlineだけを `?lang=ar` で別途実確認して合格した。失敗した元集計をPASSに書き換えていない。公開後のpageerrorは0件。

最終機械記録は [web-pwa-publication-20261101.json](web-pwa-publication-20261101.json)。公開用ZIPは証拠保存先の兄弟 `release/flashcards-pc-input-published-20261101.zip`、SHA256は `1155a80465a417f776d1905e0c84143fd7e0929709476839f8042fe0530dc4f5`。

既存の展開済み `Downloads\Flashcards PWA PC 起動 20261101` のapp配信ファイルも更新済み。起動中のPID28544は利用者が起動したserverのため停止していない。保存後に起動CMDを開き直し、必要なら更新案内の「再読み込み」で同じoriginの保存データを保持して更新できる。新版の起動用ZIPは `Downloads\Flashcards_PWA_PC_Start_20261101_UIFIX.zip`。元の起動用ZIPと公開前ZIPは上書きしていない。

OS標準の保存先ダイアログ選択・物理出音/Bluetooth・別OSの固有install操作・全翻訳キー全画面状態の網羅は、既存の未検証条件として引き続き区別する。署名AABのhashは公開後も同一。Playへはアップロードしていない。
