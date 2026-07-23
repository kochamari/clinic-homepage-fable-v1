# 原口消化器内科 ホームページ

長崎県佐世保市の「原口消化器内科」公式ホームページのソースコードです。
**公開中の本番サイト**（独自ドメイン: `haraguchishoukakinaika.jp`）です。

---

## このリポジトリの目的

- クリニックの公式サイトを管理・更新する。
- 患者・家族・地域住民に、診療内容・診療時間・アクセス・お知らせを届ける。
- スマートフォンでの見やすさと、高齢の方への読みやすさを優先する。

## 使用技術

- **ビルドツールなしの静的サイト**（プレーンな HTML / CSS / JavaScript）。
- フレームワーク・バンドラ・トランスパイラは使っていない。
- Node.js（**22 以上**）製のスクリプトが 2 本（開発サーバー・ビルド）。
- npm の依存パッケージは**現状ゼロ**。

## フォルダ構成

```
/                  各ページの HTML（index / news / service / doctors /
                   access / contact / materials / 404）
CSS/style.css      サイト全体のスタイル
JS/                サイトの JavaScript（お知らせ・演出・診療時間表示など）
images/            画像
PDF/               配布用 PDF
scripts/           dev.mjs（開発サーバー） / build.mjs（ビルド）
docs/              CLINIC_FACTS.md（確定情報） / SITE_POLICY.md（方針）
CNAME              独自ドメイン設定（変更しない）
AGENTS.md          AI・開発者共通の運用ルール
CLAUDE.md          Claude Code 向けルール（AGENTS.md を参照）
```

## セットアップ

依存パッケージはありませんが、慣例として実行できます。

```bash
npm install
```

## 開発サーバーの起動

```bash
npm run dev
```

`http://127.0.0.1:4173` で表示されます。ポートは `PORT` 環境変数で変更できます。

```bash
PORT=4188 npm run dev
```

## ビルド

```bash
npm run build
```

公開用ファイルが `dist/`（Git 管理外）に生成されます。
本番公開は GitHub Pages が担うため、通常は動作確認用です。

## テスト・lint・型チェック

- **いずれも未設定です**（テストランナー・lint・型チェックのツールはありません）。
- JS の構文だけ確認したい場合は `node -c JS/script.js` が使えます。
- 新しいツールの導入は、事前に相談してから行ってください。

## 公開（GitHub Pages と独自ドメイン）

- 公開は **GitHub Pages**。`main` ブランチのルート（`/`）をそのまま配信します。
- 独自ドメイン `haraguchishoukakinaika.jp` は `CNAME` ファイルで設定しています。
  **`CNAME` は削除・変更しないでください。**
- **`main` への push は、そのまま本番サイトの更新につながる可能性があります。**
  push はユーザーの明示的な指示があるときだけ行ってください。

## AI での開発について

- このフォルダは **Codex と Claude Code が交代で使用**します。
- 一度に編集する AI は 1 つだけにしてください。
- 作業前に必ず **`AGENTS.md`** を読んでください（共通ルール）。
- Claude Code は加えて **`CLAUDE.md`** を読みます。
