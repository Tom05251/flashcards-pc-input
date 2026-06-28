# Flashcards Notes Deluxe PC Input PWA

GitHub Pagesで公開するPCブラウザ用入力補助アプリです。

正本仕様は `../docs/progress/pwa_input_app_spec_revised_codex_ready_20260607.txt` です。最重要DoDは、PWAが出力したAndroid取り込み用ZIPをAndroid実機またはエミュレータで正常にインポートできることです。

## 開発

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

