# AKITA JPC — Halfpipe Lab

独立した3Dインスピレーション用プロトタイプです。既存のAkita Chance本体のファイルは変更しません。

## Preview
VercelでこのブランチをPreview Deploymentにすると、`/jpc-lab/` で確認できます。

## 操作
- START: 玉を動かす
- 玉数: 1〜6玉
- 初速: 動きの速さを調整
- RESET: 初期状態へ戻す
- 画面ドラッグ: カメラを少し左右に動かす

## 技術
- Three.js (CDN module)
- 3D形状・簡易的な玉の運動と玉同士の接触表現
- 現段階は見た目と操作感の確認用です。実機相当の剛体物理やJPCの抽選確率・報酬処理は未実装です。

この試作はAkitaToken、ガチャトークン、実際の報酬システムには接続していません。
