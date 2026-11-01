# インストール済みPWAの起動案内を訂正

利用者のスクリーンショットは、ExplorerでZIP内の起動.cmdだけがTempへ展開され、隣接するstart-local.cjsがないために発生したMODULE_NOT_FOUND。インストール済みなのにローカル配信用CMDの再実行を案内したことも誤りだった。

通常の起動は、デスクトップまたはスタートメニューのインストール済みPWAショートカットから行う。このPCの現在のローカル版は次の実在するリンクで、Default profile／既存app IDを使う。

`C:\Users\minor\OneDrive\デスクトップ\暗記カード＆ノートデラックス PC入力PWA.lnk`

起動先はChromeのGUIアプリ用 `chrome_proxy.exe`、app IDは `lmdfpimmmnepjdlcemkjchhbhnmjpell`。既存のローカルorigin `http://127.0.0.1:5185/flashcards-pc-input/` に対応し、公開版へ保存先を変更していない。別に公開版用の既存英語名PWAリンクもあるが、今回の案内は今のローカル版を使う。

CMDの配布物不足チェックをNode起動より前へ追加。実際にCMDだけを置いたフォルダーから2種類の起動CMDを実行し、展開手順を表示してexit 1、MODULE_NOT_FOUNDを発生させないことを確認した。README／はじめに.txtも、インストール済みアプリの起動とローカル配信serverの開始を区別した。

DownloadsのUIFIX.zipと既存の展開済みフォルダーへ修正を反映。変更は起動.cmd／はじめに.txtのみ、その他53エントリーはhash一致。既存アーカイブは証拠先のUIFIX-before-guard.zipへ全バイト保全してから置換した。元の起動用ZIP、公開用ZIP、署名Android AAB、公開Webアセットには変更を加えていない。アプリBuildと既存39言語試験は繰り返していない。

ショートカットの実在と対象exeのPE subsystem=WINDOWS_GUIを確認。自動承認審査は、旧ショートカット変更と既存Chromeアプリ直接起動を含む操作を `blocked by policy` で拒否した。詳細な理由は返されていない。その操作は未実行であり、今回こちらからの可視アプリ起動・旧shortcut修復は未検証／未実施として区別する。拒否後に別方式で同じ操作を実行していない。

利用者のブラウザーデータ・既存shortcut・起動中のserver PID28544は操作していない。起動は上記の既存PWAアイコンを利用者がダブルクリックする。

証拠：`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\.gradle-session\web-pwa-39-20261031T141213Z\quiet-launch-20261101\result.json`

修正後UIFIX.zip SHA256：`689c115b5bc07d8a38b501382c08bc74c33b62d3564082ab7b7805718e51567e`
