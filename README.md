# @henteko/podcast-website

設定ファイル 1 つで任意の Podcast 番組サイトを生成する、汎用 npm パッケージ。
HTML + TailwindCSS v4 + Cloudflare Pages (+ Pages Functions による OGP 対応)。

## 前提: API バックエンド (crosspod)

このサイトはエピソード一覧を **API 経由で取得する** SPA として動作します。
API は別途自分でホストする必要があります — 公式に推奨しているのは [crosspod](https://github.com/henteko/crosspod) (Cloudflare Workers) で、
Podcast の RSS と Apple Podcast ID を受け取って必要な JSON を返してくれます。

最小手順:

```sh
git clone https://github.com/henteko/crosspod
cd crosspod
npm install
npm run deploy
# → https://<your-worker-name>.<your-subdomain>.workers.dev が払い出される
```

詳細は [crosspod の README](https://github.com/henteko/crosspod) を参照。
払い出された URL を後述の `podcast.config.json` の `api.url` に入れる。

> 同じレスポンス形式 ([後述](#api-のレスポンス形式)) を返すなら crosspod 以外の自前 API でも動作する。

## クイックスタート

```sh
# 1. crosspod をデプロイ (上記参照)。Worker URL を控える。

# 2. 新規プロジェクトをスキャフォールド
npx @henteko/podcast-website init my-podcast
cd my-podcast

# 3. 依存をインストール
npm install

# 4. podcast.config.json を編集
#    - api.url に crosspod の URL + ?rss=...&apple_id=... を設定
#    - 番組名 / プラットフォーム URL / 配色 などを設定
$EDITOR podcast.config.json

# 5. アートカバーから OGP 画像 / favicon を生成 (src/static/ に配置)
npm run assets
#    → site.ogImage は <デプロイ先URL>/ogp.png に書き換える

# 6. ローカル開発
npm run dev      # → http://localhost:8788

# 7. デプロイ
npm run deploy   # Cloudflare Pages にデプロイ
```

## CLI

```
podcast-website init [dir]      新規プロジェクトをスキャフォールド (default: .)
podcast-website assets [url]    アートカバーから OGP 画像 / favicon を生成して src/static/ に配置
                                (url 省略時は api.url から show.imageUrl を取得)
podcast-website build           ./dist と ./functions を生成
podcast-website dev             ビルドして Tailwind watch + wrangler pages dev
podcast-website deploy          ビルドして wrangler pages deploy dist
```

### assets コマンドの出力

`src/static/` に以下を生成 (build で `dist/` 直下にコピーされる):

| ファイル | サイズ | 用途 |
| --- | --- | --- |
| `cover.<ext>` | 原寸 | ダウンロードしたアートカバーの原本 |
| `ogp.png` | 1200×1200 | OGP / Twitter Card 用 |
| `favicon.png` | 180×180 | apple-touch-icon |
| `favicon-32.png` | 32×32 | ブラウザタブ |

config の `site.favicon` / `site.favicon32` は最初から `/favicon.png` / `/favicon-32.png` を指しているので
favicon は config 編集不要。`site.ogImage` だけ自分のデプロイ先 URL + `/ogp.png` に書き換える。

スキャフォールド直後のプロジェクトには `npm run build` / `dev` / `deploy` が `podcast-website` CLI に転送されるよう設定済み。

## 設定 (`podcast.config.json`)

| キー | 説明 |
| --- | --- |
| `site` | 番組名 / 説明文 / OGP 画像 / `lang` / favicon パス |
| `api.url` | エピソード一覧 JSON を返す API エンドポイント (※自分でホストする。[crosspod](https://github.com/henteko/crosspod) を推奨) |
| `platforms.apple` / `platforms.spotify` | プラットフォーム URL とラベル |
| `social[]` | Hero / Footer に出す SNS リンク。`icon` は HTML テンプレ内 `SVG` 辞書のキー (現状は `x` を同梱) |
| `theme` | 配色 (10 種) / フォント (3 種) / Google Fonts URL |
| `i18n` | 文言 + 日付フォーマット。`"ja"` で日本語表記、それ以外は `toLocaleDateString` 経由 |

### API のレスポンス形式

`api.url` が返すべき JSON のスキーマ:

```jsonc
{
  "show": { "title": "...", "description": "...", "author": "...", "imageUrl": "..." },
  "meta": { "totalEpisodes": 42 },
  "episodes": [
    {
      "guid": "uuid-like",
      "title": "...",
      "description": "...",
      "pubDate": "2026-01-01T00:00:00.000Z",
      "duration": "00:42:13",
      "platformLinks": { "apple": "https://...", "spotify": "https://..." }
    }
  ]
}
```

[crosspod](https://github.com/henteko/crosspod) はこのスキーマで返す。自前 API を立てる場合も同じ形を満たせば差し替え可能。

## カスタマイズ (override 機構)

ビルド時、ユーザの `./src/<file>` があればパッケージ同梱のテンプレートより優先される。
配色だけなら `podcast.config.json` で完結。HTML / CSS / Pages Function に手を入れたい場合のみ override する。

```
my-podcast/
├── podcast.config.json
├── package.json
├── wrangler.jsonc
└── src/                           ← 必要なものだけ置けばよい
    ├── index.html                 ← パッケージ版 index.html より優先される
    ├── input.css                  ← 同上
    ├── _redirects                 ← 同上
    ├── functions/episode/[guid].js ← 同上
    └── static/                    ← favicon.png 等。`dist/` 直下にコピーされる
```

テンプレ内では `{{site.name}}` のようなプレースホルダが `podcast.config.json` の値で置換される。
`{{config.json}}` は config 全体を JSON として埋め込む（ランタイム JS から参照する用）。

パッケージに同梱しているテンプレートはこのリポジトリの [`templates/`](./templates) を参照。

## 仕組み

```
ユーザの ./src/* (あれば) + パッケージの templates/src/*
      │
      ▼
  build.js が {{ }} を podcast.config.json で置換
      │
      ├──→ ./dist/index.html          (静的 HTML)
      ├──→ ./functions/episode/[guid].js (Cloudflare Pages Function)
      └──→ <pkg>/.tmp/input.css → Tailwind → ./dist/style.css
                                  (中間 CSS はパッケージ側に置く。
                                   @import "tailwindcss" の resolve のため)
```

## 開発

このパッケージ自体の開発:

```sh
npm install
# 動作確認 (tarball install で実環境に近づける)
npm pack
mkdir -p /tmp/test-podcast && cd /tmp/test-podcast
node /path/to/podcast-website/bin/cli.js init .
npm install /path/to/podcast-website/henteko-podcast-website-0.1.0.tgz
npm run build
```

`npm link` でも可。

## 公開

`npm publish` でスコープ付き public パッケージとして公開される (`publishConfig.access = "public"`)。

## ライセンス

Apache License 2.0 — 詳細は [LICENSE](./LICENSE) を参照。
