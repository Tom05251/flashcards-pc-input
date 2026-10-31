# Web/PWA 修復・公開承認待ちの記録

対象は `Tom05251/flashcards-pc-input`、作業ブランチは `codex/android-v14-roundtrip-20261030`。開始点 `e4587584474eb4a98578815a50aadc6c4f3d2e67` から既存成果を継承した。途中保存 `380445f6a601af7e7a9796fbc13696534d5f9b18` は通常Push済み。最終commitと配布ZIPの対応は、QA保存先の `release/release-manifest.json` に記録する。

39言語それぞれ228キー、計8,892件を実装・使用箇所に照合して意味審査した。既存の正しい2,448件を維持し、3,181件を修復、3,263件を追加。英語も17件を修正し、日本語・ヒンディー語・ベンガル語・簡体字・繁体字を無条件合格にせず再確認した。現用201キーとmanifest専用の説明文を含み、審査対象の英語fallback・変数破損・番号／型の不一致は0件。未使用の旧定義は保持している。

| 領域 | 確認結果と範囲 |
| --- | --- |
| 翻訳 | 全39言語で意味・構造審査完了。主要画面の実操作と原寸画像は39/39合格。主マトリクスは3,783言語キー組・276画像・585回の実チュートリアル遷移。全キー全状態の画面網羅とは区別。 |
| Template／Export | CSV・JSON・ZIPの見本に利用者データを含めない。実データのCSV／JSON出力は独立した明示ボタンで保持。CSV原文・引用符・Unicode・タグ・式解釈注意を保持。 |
| Import | 解析はメモリ内。Merge／Replaceの影響・件数・欠損添付を表示し、確定前はDB・媒体・ID・設定不変。取消、読込中取消、Replace成功、再読込を実確認。 |
| 競合／保存 | 保存queue、revision CAS、transaction直前のpreview前提検査。別タブの未確定編集、確定後にDB待機中の変更、古い保存完了、容量不足／abort、一体commit、再保存を実IndexedDBで確認。保存済み表示は最新commit後のみ。 |
| 既存データ | v1→v2はrevision情報を追加し、既存教材・媒体を保持。Folderの未知拡張もMerge時に保持。既存の不正HLは閲覧・編集で消去せず、Review／明示Remove＋Saveで修復可能。 |
| 不正ファイル | 色欠落／null HLで画面が空になる2件を再現して修復。型不正の既知UIフィールドはpreview前に拒否。26件のhost確認、実JSON／ZIP／CSV拒否6件、既存交換ファイル4形式の同一性、旧DB回復・正常6欄Undo／Redo等5件を確認。 |
| 表示／操作 | 4段のQuestion／Answer／Hint1／Hint2と独立HLを保持。Folder操作・保存先解除・補足文・添付名の重なりを修復。実Chrome125%で修復対象を39言語、273文字範囲と実クリックで確認。狭幅では内部横scroll、4欄は縦scrollで到達する。 |
| 媒体 | 画像読込、実音声コントロールの再生進行・一時停止、説明文、共有添付の保持、ZIPの媒体バイトを実確認。物理スピーカー出音は別条件。 |
| PWA | 39言語のoffline起動・manifestと既存IDを保持。実install→standalone起動、旧公開版からのDB／worker更新、別タブの更新時の未保存入力保護、保存後の更新、offlineでのbrowser再起動を確認。 |
| 保存先 | 実FileSystemFileHandleのwrite／close、Picker取消契約、実download fallback・失敗表示を確認。Windows標準保存先ダイアログの実選択は未操作。 |
| Android v14 | 既存署名APKで通常Import／Export→Web preview確定・再読込の正式ZIP往復とJSON／CSV差分確認を完了。既存4教材・4媒体・設定／課金／履歴を保持し、専用API35を元設定・root UID2000へ戻して閉鎖。Androidの任意拡張フィールド直列化は主張せず、Web側のstable-key Mergeで未知項目を保持。 |

最新ソースで `npm run verify`（Build／lint／翻訳／offline）通過。追加変更は関連単位で検証し、無変更の39言語全試験・Android全Buildを繰り返していない。過去のZIP境界・CRC・codec証拠は処理本文・依存hashを照合して再利用した。

PWA試験の元集計には、QA初期化をopaque文書でも実行した例外があったため、そのraw PASSバッジは採用していない。12件の機能assertionは保持し、別の正確な例外再現と対象origin限定の初期化、実起動・新規target・standalone・offlineのエラー0件によりQA境界を解消した。元のエラーへURL・stackを後付けしていない。全失敗記録は保持している。

証拠の索引は [web-pwa-acceptance-20261101.json](web-pwa-acceptance-20261101.json)。原本・各キーの原文／既存／修復hash・実画像・試験条件は以下に保全した。

`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\.gradle-session\web-pwa-39-20261031T141213Z`

未検証は、Windows標準保存ダイアログでの実際の保存先選択、物理出音／Bluetooth、検証したWindows Chrome以外のOS固有install操作、全228キーの全画面状態の網羅。未commitデータの強制終了時保持は保証対象外。折り畳まれた言語選択の省略表示とリスト要約のellipsisは、完全同時表示の合格に含めない。意味審査、構造検査、実画面確認を混同しない。

署名済みAndroid userRelease versionCode14 AABは変更せず保全済み。

`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\app\user\release\app-user-release.aab`

SHA256: `8675474db4527b5058e3c3474913872106e4b71360dcce26f5247a24f37510de`

公開用ZIPは `release/flashcards-pc-input-prepublish-20261101.zip`。静的配信ファイル51件を含み、CRCと全ファイルSHAを `dist` と照合済み。SHA256: `f3881ade3e8b4b5b5c01fb12956554ad6b7c61607138c60da0ae753600f014b7`。

公開は未実施。公開中の [GitHub Pages](https://tom05251.github.io/flashcards-pc-input/) はHTTP200と旧 `index-DNUutMkX.js` を確認し、`main=468cb24a89b16a0b307031e3187e3fc55c174e86`、`gh-pages=e00708cff0f31132f00388d0f491db22be888b2f` は据え置き。作業ブランチの修復には、既存Hint2・HL・安定ID・sourceFields・CSVタグ・ZIP境界修復と、今回の翻訳・Template・Import・保存・PWA修復が含まれる。

公開承認後の手順は以下のとおり。GitHub Pagesの公開元設定は [公式手順](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) に従う。

ローカルで再表示する場合は、このrepoで `npm run preview -- --host 127.0.0.1 --port 5185` を実行し、`http://127.0.0.1:5185/flashcards-pc-input/` を開く。本作業の検証用browser・専用AVD・preview／dev serverは終了している。

1. 承認対象の最終commit、`release-manifest.json`、ZIPのSHAを照合し、既存Pagesのbranch／folder／custom domain設定を確認する。
2. 公開用の別checkoutで、検証済みZIPルートの51ファイルを配信rootへ配置する。base pathは `/flashcards-pc-input/`。既存のPages設定・CNAME・`.nojekyll` があれば保持する。
3. 承認された公開元へ通常commit／pushし、Pagesの配信完了を確認する。mainへのmergeは明示承認された場合のみ行う。force push／reset／cleanは使わない。
4. 利用者は旧版で作成・保存を完了し、必要なZIPを書き出してから、このサイトの全タブ・PWAウィンドウを閉じ、ブラウザーを通常終了・再起動して同じURLを開く。この経路は旧公開版から最終版への実移行で、追加reload・手動activation・データ消去なしに確認済み。以後の新版更新は未保存状態を保護する更新案内を使う。
5. 公開URLの主要言語・RTL・offline・旧profile更新を隔離profileでsmoke確認し、公開commitを記録する。利用者の実profileを初期化しない。

現在は公開承認待ち。main／gh-pagesへのmerge・push、公開デプロイ、Play upload、強制Push、既存データ初期化は行っていない。
