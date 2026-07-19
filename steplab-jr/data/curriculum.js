// STEP LAB. Jr. カリキュラム定義
// 小学校学習指導要領(平成29年告示)の内容構成に基づき単元を整理。
// gen: 問題生成方式（generators.js のキー） / pool: 固定問題プールのキー
// note: 「学ぶ」ステップで表示するまとめノート

const C = [];
function unit(subject, grade, id, name, note, src, extra) {
  C.push(Object.assign({ subject, grade, id, name, note }, src, extra || {}));
}

/* ================= 算数 ================= */
// 1年
unit('math', 1, 'm1-kazu', '10までのかず・20までのかず',
  'ものの かずを かぞえて すうじで かこう。10のまとまりを つくると かぞえやすいよ。', { gen: 'count20' });
unit('math', 1, 'm1-tashizan', 'たしざん（くりあがりなし）',
  '「あわせて いくつ」「ふえると いくつ」は たしざん。しきは 3+2=5 のように かくよ。', { gen: 'add_nc' });
unit('math', 1, 'm1-hikizan', 'ひきざん（くりさがりなし）',
  '「のこりは いくつ」「ちがいは いくつ」は ひきざん。しきは 5-2=3 のように かくよ。', { gen: 'sub_nb' });
unit('math', 1, 'm1-kuriagari', 'くりあがりの あるたしざん',
  '9+4は、9に1を たして10。のこりの3を たして13。10の まとまりを つくるのが こつだよ。', { gen: 'add_c' });
unit('math', 1, 'm1-kurisagari', 'くりさがりの あるひきざん',
  '13-9は、10から9を ひいて1。のこりの3と あわせて4。10から ひくと かんたんだよ。', { gen: 'sub_b' });
unit('math', 1, 'm1-ookii', '大きい かず（100まで）',
  '10が いくつと 1が いくつで かんがえよう。10が3つと1が5つで 35だよ。', { gen: 'count100' });
unit('math', 1, 'm1-tokei', 'とけい（なんじ・なんじはん）',
  'みじかい はりが「じ」、ながい はりが「ふん」。ながい はりが 12なら「〜じ」、6なら「〜じはん」。', { pool: 'clock1' });

// 2年
unit('math', 2, 'm2-hissan', 'たし算・ひき算の ひっ算',
  'くらいを そろえて 一のくらいから 計算しよう。くり上がり・くり下がりに 気をつけて。', { gen: 'add_sub_2d' });
unit('math', 2, 'm2-kuku', 'かけ算九九',
  'かけ算は「1つ分の数 × いくつ分」。九九は くりかえし となえて おぼえよう。', { gen: 'kuku' });
unit('math', 2, 'm2-nagasa', '長さ（cm・mm）',
  '1cm = 10mm。ものさしの めもりを ていねいに 読もう。', { gen: 'length_cm' });
unit('math', 2, 'm2-jikoku', '時こくと 時間',
  '「時こく」は とけいが さす とき。「時間」は 時こくと 時こくの あいだの 長さだよ。1時間=60分。', { pool: 'clock2' });
unit('math', 2, 'm2-1000', '1000までの 数',
  '100が いくつ、10が いくつ、1が いくつで 考えよう。345は 100が3つ、10が4つ、1が5つ。', { gen: 'count1000' });
unit('math', 2, 'm2-zukei', '三角形と 四角形',
  '3本の 直線で かこまれた 形が 三角形、4本なら 四角形。かどの 点を「ちょう点」、直線を「辺」というよ。', { pool: 'shape2' });

// 3年
unit('math', 3, 'm3-warizan', 'わり算',
  '12÷3は「12を3つに 同じように 分けると いくつ」。九九を つかって もとめられるよ。', { gen: 'div_basic' });
unit('math', 3, 'm3-hissan', 'かけ算の 筆算',
  '一のくらいから じゅんに かけて、くり上がりを たしていこう。', { gen: 'mul_2d1d' });
unit('math', 3, 'm3-ookii', '大きい数（万）',
  '一、十、百、千、万。4けたごとに くらいの 名前が かわるよ。10000は「一万」。', { gen: 'big_man' });
unit('math', 3, 'm3-shosu', '小数',
  '1を10等分した 1つ分が 0.1。0.1が 3つで 0.3だよ。小数点の いちを そろえて 計算しよう。', { gen: 'dec_add_sub' });
unit('math', 3, 'm3-bunsu', '分数',
  '1を 同じ大きさに 3つに 分けた 1つ分が 1/3。分母が 同じ 分数は 分子どうしを たしたり ひいたり できるよ。', { gen: 'frac_same' });
unit('math', 3, 'm3-jikan', '時間と 長さ（km）',
  '1分=60秒、1km=1000m。「道のり」は 道にそって はかった 長さだよ。', { gen: 'km_m' });

// 4年
unit('math', 4, 'm4-oku', '大きい数（億・兆）',
  '万の 10000倍が 億、億の 10000倍が 兆。4けたずつ 区切って 読もう。', { gen: 'big_oku' });
unit('math', 4, 'm4-waru', 'わり算の 筆算',
  'たてる→かける→ひく→おろす の くり返し。あまりは わる数より 小さくなるよ。', { gen: 'div_long' });
unit('math', 4, 'm4-gaisu', 'がい数',
  'およその 数の ことを がい数と いうよ。四捨五入は 0〜4なら 切り捨て、5〜9なら 切り上げ。', { gen: 'round' });
unit('math', 4, 'm4-shosu', '小数の かけ算・わり算',
  '小数×整数は 整数の 計算を してから 小数点を うとう。', { gen: 'dec_mul' });
unit('math', 4, 'm4-kakudo', '角度',
  '角の 大きさは「度(°)」で 表すよ。直角は90°、一直線は180°、1回転は360°。', { pool: 'angle4' });
unit('math', 4, 'm4-menseki', '面積',
  '長方形の面積 = たて × よこ。正方形の面積 = 1辺 × 1辺。単位は cm² や m²。', { gen: 'area_rect' });

// 5年
unit('math', 5, 'm5-shosu', '小数の かけ算・わり算',
  '小数×小数は、整数として計算してから、小数点以下のけた数の 合計だけ 小数点を 左に うつすよ。', { gen: 'dec_mul_dec' });
unit('math', 5, 'm5-baisu', '倍数と 約数',
  '3の倍数は 3,6,9…。12の約数は 1,2,3,4,6,12。公倍数・公約数も 見つけられるように なろう。', { gen: 'mult_div_isor' });
unit('math', 5, 'm5-bunsu', '分数の たし算・ひき算',
  '分母が ちがう 分数は、通分（分母を そろえる）してから 計算しよう。', { gen: 'frac_diff' });
unit('math', 5, 'm5-heikin', '平均と 単位量あたり',
  '平均 = 合計 ÷ 個数。「1mあたり」「1人あたり」のように 単位量あたりで 比べると わかりやすいよ。', { gen: 'average' });
unit('math', 5, 'm5-wariai', '割合',
  '割合 = 比べられる量 ÷ もとにする量。0.1=10%=1割。百分率と 歩合も おぼえよう。', { gen: 'ratio' });
unit('math', 5, 'm5-menseki', '図形の 面積',
  '三角形 = 底辺×高さ÷2。平行四辺形 = 底辺×高さ。台形 = (上底+下底)×高さ÷2。', { gen: 'area_tri' });

// 6年
unit('math', 6, 'm6-bunsu', '分数の かけ算・わり算',
  '分数×分数は 分母どうし・分子どうしを かける。わり算は わる数を 逆数にして かけ算に しよう。', { gen: 'frac_mul' });
unit('math', 6, 'm6-moji', '文字と 式',
  'わからない数を x や a などの 文字で 表すよ。x+5=12 なら x=7。', { gen: 'algebra' });
unit('math', 6, 'm6-hi', '比',
  '2:3 のように 表すのが 比。両方に 同じ数を かけても わっても 等しい比に なるよ。', { gen: 'hi' });
unit('math', 6, 'm6-en', '円の 面積',
  '円の面積 = 半径 × 半径 × 3.14。円周 = 直径 × 3.14。', { gen: 'circle' });
unit('math', 6, 'm6-hayasa', '速さ',
  '速さ = 道のり ÷ 時間。道のり = 速さ × 時間。時間 = 道のり ÷ 速さ。', { gen: 'speed' });
unit('math', 6, 'm6-hirei', '比例と 反比例',
  'y = きまった数 × x なら比例。y = きまった数 ÷ x なら反比例だよ。', { gen: 'prop' });

/* ================= 国語 ================= */
unit('ja', 1, 'j1-hiragana', 'ひらがな・かたかな',
  'ひらがなと かたかなを ただしく よもう。かたかなは がいこくから きた ことばなどに つかうよ。', { pool: 'kana1' });
unit('ja', 1, 'j1-kanji', '1年生の かん字',
  '1年生では 80字の かん字を ならうよ。よみかたを おぼえよう。', { kanji: 'k1' });
unit('ja', 1, 'j1-joshi', '「は・を・へ」の つかいかた',
  '「わたしは」「ほんを」「がっこうへ」。くっつきの「は・を・へ」は「わ・お・え」と よむよ。', { pool: 'joshi1' });
unit('ja', 1, 'j1-kotoba', 'ことばあつめ（なかまの ことば）',
  'どうぶつ、くだもの、のりもの…。なかまに なる ことばを あつめよう。', { pool: 'kotoba1' });

unit('ja', 2, 'j2-kanji', '2年生の 漢字',
  '2年生では 160字の 漢字を ならうよ。読みかたを おぼえよう。', { kanji: 'k2' });
unit('ja', 2, 'j2-katakana', 'かたかなで 書く ことば',
  '外国から きた ことば、外国の 国や 人の 名前、ものの 音や どうぶつの なき声は かたかなで 書くよ。', { pool: 'katakana2' });
unit('ja', 2, 'j2-hantai', 'はんたいの いみの ことば',
  '「大きい⇔小さい」「あつい⇔さむい」。はんたいの いみの ことばを ペアで おぼえよう。', { pool: 'hantai2' });
unit('ja', 2, 'j2-bun', '文の くみたて（主語と 述語）',
  '「だれが（は）」に あたる ことばが 主語、「どうする・どんなだ」に あたる ことばが 述語だよ。', { pool: 'shugo2' });

unit('ja', 3, 'j3-kanji', '3年生の 漢字',
  '3年生では 200字の 漢字を ならうよ。音読みと 訓読みに 気をつけよう。', { kanji: 'k3' });
unit('ja', 3, 'j3-kotowaza', 'ことわざ・慣用句',
  '「さるも木から落ちる」のような 昔からの 言いつたえが ことわざ。「頭をひねる」のような きまった 言い方が 慣用句だよ。', { pool: 'kotowaza3' });
unit('ja', 3, 'j3-kokuji', '国語辞典の つかい方・ローマ字',
  '国語辞典は 五十音順に ならんでいるよ。ローマ字では a,i,u,e,o が ぼいんだよ。', { pool: 'romaji3' });
unit('ja', 3, 'j3-shushoku', '修飾語',
  '「白い 花が きれいに さく」。「白い」「きれいに」のように くわしくする ことばが 修飾語だよ。', { pool: 'shushoku3' });

unit('ja', 4, 'j4-kanji', '4年生の 漢字',
  '4年生では 202字の 漢字を ならうよ。都道府県の 漢字も 出てくるよ。', { kanji: 'k4' });
unit('ja', 4, 'j4-jukugo', '熟語の 組み立て',
  '「高低（反対の意味）」「読書（〜を〜する）」「強風（上が下を修飾）」。熟語の 組み立てには 種類が あるよ。', { pool: 'jukugo4' });
unit('ja', 4, 'j4-tsunagi', 'つなぎ言葉（接続語）',
  '「だから（順接）」「しかし（逆接）」「また（並立）」。文と文を つなぐ 言葉の はたらきを 考えよう。', { pool: 'tsunagi4' });
unit('ja', 4, 'j4-kanyoku', '慣用句・故事成語',
  '「五十歩百歩」「蛇足」のように 昔の 中国の 話から できた 言葉を 故事成語と いうよ。', { pool: 'koji4' });

unit('ja', 5, 'j5-kanji', '5年生の 漢字',
  '5年生では 193字の 漢字を ならうよ。同音異義語に 気をつけよう。', { kanji: 'k5' });
unit('ja', 5, 'j5-keigo', '敬語',
  '「です・ます（丁寧語）」「おっしゃる（尊敬語）」「申す（謙譲語）」。相手や 場面に 合わせて つかい分けよう。', { pool: 'keigo5' });
unit('ja', 5, 'j5-doon', '同音異義語・同訓異字',
  '「機会と機械」「暑いと熱い」。読みが 同じでも 意味が ちがう 言葉に 気をつけよう。', { pool: 'doon5' });
unit('ja', 5, 'j5-wago', '和語・漢語・外来語',
  '訓読みの 言葉が 和語、音読みの 言葉が 漢語、外国から 入って きた 言葉が 外来語だよ。', { pool: 'wago5' });

unit('ja', 6, 'j6-kanji', '6年生の 漢字',
  '6年生では 191字の 漢字を ならうよ。小学校の 漢字は これで 全部で 1026字だよ。', { kanji: 'k6' });
unit('ja', 6, 'j6-shijigo', '敬語の つかい分け・言葉づかい',
  '尊敬語と 謙譲語の 区別を 完ぺきに しよう。「先生が おっしゃる」「わたしが 申し上げる」。', { pool: 'keigo6' });
unit('ja', 6, 'j6-kotowaza', '故事成語・四字熟語',
  '「一石二鳥」「温故知新」など、四字熟語の 意味と つかい方を 学ぼう。', { pool: 'yoji6' });
unit('ja', 6, 'j6-bunpo', '文の 組み立て（複文・重文）',
  '主語・述語の 関係が 2つ以上 ある文も あるよ。文の 組み立てを 考えて 読もう。', { pool: 'bunpo6' });

/* ================= 英語 ================= */
// 1・2年は指導要領外の先取り学習（発展）として提供
unit('en', 1, 'e1-abc', 'アルファベットに したしもう ★先取り',
  'A・B・C…アルファベットの 大文字を 見て よめるように なろう。', { pool: 'abc1' }, { advanced: true });
unit('en', 2, 'e2-greet', 'えいごの あいさつ ★先取り',
  'Hello!（こんにちは） Good morning!（おはよう） Thank you!（ありがとう）', { pool: 'greet2' }, { advanced: true });
// 3・4年: 外国語活動 / 5・6年: 外国語科
unit('en', 3, 'e3-abc', 'アルファベット（大文字）',
  'AからZまで 26文字。大文字を 読めるように なろう。', { pool: 'abc3' });
unit('en', 3, 'e3-color', '色と 形',
  'red（赤） blue（青） yellow（黄色） circle（円） triangle（三角形）', { vocab: 'v_color' });
unit('en', 3, 'e3-num', '数（1〜20）',
  'one, two, three... 数の 言い方を おぼえよう。How many? は「いくつ?」', { vocab: 'v_num' });
unit('en', 3, 'e3-greet', 'あいさつ・気持ち',
  "Hello! How are you? — I'm fine! / I'm happy!（うれしい）sad（かなしい）", { vocab: 'v_feel' });
unit('en', 4, 'e4-abc', 'アルファベット（小文字）',
  'a b c d... 小文字も 読めるように なろう。大文字と 形が ちがう ものに 注意。', { pool: 'abc4' });
unit('en', 4, 'e4-week', '曜日と 天気',
  'Monday（月曜日）〜 Sunday（日曜日）。sunny（晴れ） rainy（雨）', { vocab: 'v_week' });
unit('en', 4, 'e4-time', '時刻と 一日の 生活',
  "What time is it? — It's 7 o'clock. wake up（おきる） lunch time（お昼の時間）", { vocab: 'v_time' });
unit('en', 4, 'e4-stationery', '文ぼう具・持ち物',
  'pen, pencil（えんぴつ）, eraser（けしゴム）, ruler（じょうぎ）。Do you have a pen?', { vocab: 'v_stat' });
unit('en', 5, 'e5-self', '自己しょうかい（I like / I can）',
  'I like soccer.（サッカーが すき） I can swim.（およげる） 自分の ことを 伝えよう。', { vocab: 'v_verb' });
unit('en', 5, 'e5-subject', '教科と 職業',
  'math（算数） science（理科） teacher（先生） doctor（医者） What do you want to be?', { vocab: 'v_job' });
unit('en', 5, 'e5-month', '月と 季節・行事',
  'January〜December の 12か月。spring（春） summer（夏） When is your birthday?', { vocab: 'v_month' });
unit('en', 5, 'e5-food', '食べ物と ねだん',
  "What would you like? — I'd like pizza. How much is it? — It's 300 yen.", { vocab: 'v_food' });
unit('en', 6, 'e6-daily', '日常生活を つたえる',
  'I get up at 6. I usually walk to school. 一日の 生活を 英語で 言おう。', { vocab: 'v_daily' });
unit('en', 6, 'e6-past', '過去の ことを つたえる',
  'I went to the zoo. I ate curry. It was fun! 夏休みの 思い出を 伝えよう。', { vocab: 'v_past' });
unit('en', 6, 'e6-country', '国と 行きたい場所',
  'Where do you want to go? — I want to go to Italy. 国の 名前を おぼえよう。', { vocab: 'v_country' });
unit('en', 6, 'e6-junior', '中学校へ むけて',
  'I want to join the tennis team. I want to enjoy the school festival. 中学校で したい ことを 伝えよう。', { vocab: 'v_junior' });

const SUBJECTS = {
  ja:   { name: 'こくご',  color: '#e8618c', icon: '📖' },
  math: { name: 'さんすう', color: '#3d7ff0', icon: '🔢' },
  en:   { name: 'えいご',  color: '#25a55f', icon: '🌏' },
};

module.exports = { UNITS: C, SUBJECTS };
