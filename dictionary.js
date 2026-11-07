// ==========================================
// SAY - 秋田弁変換エンジン（無料・ルールベース試験版）
// 県内で比較的知られる表現を控えめに使用。
// 地域差や文脈が大きい表現は無理に変換しない。
// ==========================================
const akitaPhraseRules = [
    ["ありがとうございます", "ありがどございます"],
    ["ありがとうございました", "ありがどございました"],
    ["よろしくお願いします", "よろしくたのむんし"],
    ["おはようございます", "おはようさん"],
    ["こんにちは", "おばんです"],
    ["こんばんは", "おばんです"],
    ["そうですね", "んだな"],
    ["そうだね", "んだな"],
    ["そうですよ", "んだよ"],
    ["そうなんだ", "んだが"],
    ["とてもおいしい", "しったげうめ"],
    ["すごくおいしい", "しったげうめ"],
    ["何しているの", "なにしてら？"],
    ["何してるの", "なにしてら？"],
    ["どうしたの", "どした？"],
    ["大丈夫ですか", "だいじょうぶだが？"]
];
const akitaPhraseRules = [
    ["ダメです", "なんねっす"],
    ["だめです", "なんねっす"],
    ["ダメだ", "なんね"],
    ["だめだ", "なんね"],
const akitaWordRules = [
    ["ありがとう", "ありがど"],
    ["おいしい", "うめ"],
    ["美味しい", "うめ"],
    ["すごい", "しったげ"],
    ["とても", "しったげ"],
    ["寒い", "さみ"],
    ["暑い", "あっちぇ"],
    ["だめ", "なんね"],
    ["ダメ", "なんね"],
    ["私", "おら"],
    ["わたし", "おら"],
    ["僕", "おら"],
    ["俺", "おら"]
];

function convertToAkita(input) {
    if (typeof input !== "string" || !input.trim()) return input || "";
    let result = input;
    for (const [standard, akita] of [...akitaPhraseRules].sort((a, b) => b[0].length - a[0].length)) {
        result = result.split(standard).join(akita);
    }
    for (const [standard, akita] of [...akitaWordRules].sort((a, b) => b[0].length - a[0].length)) {
        result = result.split(standard).join(akita);
    }
    result = result.replace(/ですね([。！!？?]?)(\s*)$/u, "だな$1$2");
    result = result.replace(/だよね([。！!？?]?)(\s*)$/u, "だよな$1$2");
    result = result.replace(/でしょう([。！!？?]?)(\s*)$/u, "だべ$1$2");
    result = result.replace(/だろう([。！!？?]?)(\s*)$/u, "だべ$1$2");
    return result;
}
window.convertToAkita = convertToAkita;
