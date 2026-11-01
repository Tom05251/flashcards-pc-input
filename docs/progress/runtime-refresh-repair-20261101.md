# ローカル稼働版への反映漏れと更新検知の修復

## 原因と実修復

ショートカットだけを変更しても、利用者のlocalhost:5185では旧 `index-D7-Tz2GR.js` が配信され続けていた。従来のstart-local.cjsは起動時に全ファイルをMapへ読み込み、ディスク上のapp更新を反映しない実装だった。

root内の実ファイルを要求ごとに読み取る処理へ修正し、canonical pathの範囲検査、GET／HEAD限定、loopback・同一ポートを保持した。起動中のPID28544をコマンドラインとlistenerで特定し、静的配信だけを行う当該Nodeを、hiddenのPID21712へ置き換えた。親shell、利用者のbrowser／IndexedDB／未保存editor／設定は操作していない。OneDriveへの書込みはない。

さらに、最初のservice worker登録前から開き続けたdocumentでは、Workboxのcontrolling通知にisUpdateが付かず、更新ボタンでworkerがactivateしても画面が切り替わらない条件を再現した。実controllerの交代も監視し、重複通知は抑制、未保存／Import中のreload保護は既存refを使うよう修正した。初回controller取得自体ではreloadしない。

製品ソースcommit：`0c2c03826e576910318b1cc5787a6e70cc7b66e1`

公開commit：`52c874b476839b55142751395921e6d1d0db0f06`

現在のbundle：`assets/index-nEEbSb7m.js`

## 検証範囲

変更後のnpm run verify（Build／lint／39言語・228キーの構造／offline）が合格。翻訳値・描画条件・CSS・Import／保存形式は変更していないため、既存の意味審査は保持し再監査していない。

実ブラウザーの隔離contextで9件合格、pageerror 0件。配信中のファイル差替え、新規assetと変更内容の即時反映、51ファイルのhash、旧D7からのworker更新、保存前editorの保護、教材・Hint1／Hint2・添付Blob・revision保持、更新後の案内／追加済み非表示、offline、現行版の初回controller条件の一回の更新操作、別タブ更新でのdraft保護を確認した。

今回のstandalone分岐は隔離contextのnavigator.standalone=trueで検証した。OSへの新規PWA登録はしていない。従前の実nativeインストール試験は、変えていない表示処理の参考証拠であり、新しいnEEバイナリのnative実画面合格へ転記しない。テストで利用者のDesktop／OneDriveへ新しいアイコンを作成していない。

初回の2件のFAILは、旧D7の初回documentでworkerがactivateしても旧UIに残る不具合の再現であり、保存している。既インストール相当のcontroller済み旧documentからの移行と、修正後の現行版の初回controller条件を別々に検証した。古いコードを既に実行中のdocumentへ新コードを後付けはできないため、旧版の利用者は保存後に通常再読み込みし、更新案内が出たらその再読み込みを使う。サイトデータ消去は不要。

稼働中の実localhost:5185と公開HTTPの51ファイル、および公開Git blobが検証済みdistと全hash一致。Pages buildも公開commitでbuiltを確認。公開後のJAブラウザーの×と保持を確認した。実localhostからの新bundle表示とstandalone分岐も隔離contextで確認した。

実利用者の現在のPWAウィンドウは未確認。computer-use／browser-useのkernel初期化が `failed to write kernel assets: 指定されたパスが見つかりません。 (os error 3)` で失敗し、reset後の再試行も同じだった。代替のWindows UI自動化はしていない。利用者へ保存後の画面更新と表示確認を依頼中で、表示済みとは断言しない。

## 配布と保全

起動口は引き続きOneDrive外の `C:\Users\minor\Downloads\Flashcards_PC_Input\アプリを起動.lnk`。Default profile／同じlocal PWAを開く既存設定を保持している。

展開済みappには新assetを先に配置し、index／workerを最後に原子的に置換した。旧assetは旧clientのため残した。UIFIX.zipも同じ配信内容とread-through runtimeへ更新し、旧ZIPを証拠先へ全バイト保全した。新ZIP SHA256は `04eb2593088bbc564aa2f14c45114919947bf92ba84a15b82b3059341c025585`。

Android AABは変更せず、SHA256 `8675474db4527b5058e3c3474913872106e4b71360dcce26f5247a24f37510de` を再確認。Android Build／Play upload／main merge／force push／reset／cleanは行っていない。

証拠保存先：`C:\Users\minor\AndroidStudioProjects\FlashcardsAndroidStarter\.gradle-session\web-pwa-39-20261031T141213Z\runtime-refresh-20261101`

`result.json`（9件）、`provided-runtime-replaced.json`（稼働process置換）、`applied-build.json`（実local配信照合）、`final-delivery.json`（公開built／51ファイル／実local表示の範囲）、および旧FAILを保持した。現在の実利用者画面は未確認として区別する。
