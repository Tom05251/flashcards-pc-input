# Flashcards Notes Deluxe PC Input PWA

GitHub Pagesで公開するPCブラウザ用入力補助アプリです。

正本仕様は `../docs/progress/pwa_input_app_spec_revised_codex_ready_20260607.txt` です。最重要DoDは、PWAが出力したAndroid取り込み用ZIPをAndroid実機またはエミュレータで正常にインポートできることです。

## インストール済みアプリの起動

デスクトップまたはスタートメニューにあるPC入力PWAのアイコンから直接開いてください。ZIPや起動.cmdを毎回開く必要はなく、Nodeの黒いウィンドウも使いません。公開版は <https://tom05251.github.io/flashcards-pc-input/> です。公開版とローカル版は保存領域が別なので、今使っているアプリのショートカットを使ってください。

## 開発・ローカル配信用の起動

ローカル配信を開始する場合に限り、起動用ZIPを「すべて展開」してから **起動.cmd** をダブルクリックします。ZIP内からの直接起動には対応しません。既存のNode.js 22以降を使い、npm installは不要です。これは配信用serverのため、実行中のウィンドウは開いたまま使ってください。URLは `http://127.0.0.1:5185/flashcards-pc-input/` です。公開サイトとは保存領域が別なので、既存データは必要に応じてZIPで交換します。

このリポジトリでは、ビルド済みの `dist` があれば **start-pwa-input.cmd** で同じアプリを開けます。公開用ZIPはWeb配信ファイルで、index.htmlの直接起動には対応しません。起動用ZIPの作成は `node scripts/package-local-preview.cjs <新しい出力ZIPパス>` で行い、現在のdistを変更せず同梱します。

## 開発コマンド

```powershell
npm install
npm run dev
npm run build
```

## 方針

- ユーザー入力本文は翻訳しません。
- 外部翻訳API、APIキー、サーバー通信は使いません。
- アプリ固定文言のみを多言語表示します。
- `localStorage` は言語、テーマ、チュートリアル完了など軽量設定専用です。
- カード、ノート、メディアBlobは `IndexedDB` に保存します。
- 初期版はAndroid取り込み用ZIP/JSON/CSV作成を優先し、Androidへの直接通信は含めません。

