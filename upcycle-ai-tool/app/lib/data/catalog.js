'use strict';

// 内置示例与本地规则方案。所有费用是估计值，用时由步骤时长累加得出，
// 材料与工具是否可用由 lib/planner.js 的约束引擎实时判定，不是写死的文案。

const TOOLS = [
  { id: 'hands', label: '徒手', always: true, hint: '无需工具' },
  { id: 'scissors', label: '剪刀', common: true },
  { id: 'cutter', label: '美工刀', common: true },
  { id: 'ruler', label: '尺子', common: true },
  { id: 'pencil', label: '铅笔', common: true },
  { id: 'glue', label: '胶水', common: true },
  { id: 'tape', label: '胶带', common: true },
  { id: 'needle', label: '针线' },
  { id: 'punch', label: '打孔器' },
  { id: 'paint', label: '颜料 / 笔刷' },
  { id: 'string', label: '麻绳' },
  { id: 'hotglue', label: '热熔胶枪' },
  { id: 'drill', label: '电钻' },
  { id: 'saw', label: '锯子' }
];

const TOOL_IDS = TOOLS.map((t) => t.id);
const TOOL_LABELS = Object.fromEntries(TOOLS.map((t) => [t.id, t.label]));
const DEFAULT_TOOLS = ['scissors', 'ruler', 'pencil', 'glue', 'tape'];

const LANES = [
  { id: 'practical', label: '实用款', tone: 'green', blurb: '先好用，再好看' },
  { id: 'aesthetic', label: '好看款', tone: 'orange', blurb: '摆着就顺眼' },
  { id: 'wild', label: '脑洞款', tone: 'indigo', blurb: '不实用也没关系' }
];

// --- 构造小工具 -----------------------------------------------------------
// opts.effect 记录这一步实际造成的状态（是否产生新切口）；opts.when 声明本做法只在该状态下可用。
const V = (needs, text, minutes, note, opts) =>
  Object.assign({ needs, text, minutes }, note ? { note } : {}, opts || {});
const S = (label, variants, optional) => ({ label, variants, optional: Boolean(optional) });
const M = (name, qty, cost, opts) => Object.assign({ name, qty, cost, optional: false, requires: [] }, opts || {});

const ORIGIN = (name) => M(name, '原物 1 件', 0, { note: '闲置物本身，不计费用' });

// --- 示例 -----------------------------------------------------------------
const SAMPLES = {
  carton: {
    id: 'carton',
    name: '瓦楞纸箱',
    material: '瓦楞纸板',
    hint: '快递箱、鞋盒都算',
    plans: [
      {
        id: 'carton-practical',
        lane: 'practical',
        title: '三格桌面文件立架',
        result: '三格立式收纳架',
        summary: '借纸箱原有折痕做底板与立板，分出三格，信件、笔记本、充电线各归一处。',
        // w=宽、h=深、d=立起后的高度。dims 是结构标注的唯一真源，详情图 / 分享卡 / 制作清单都读它。
        diagram: {
          type: 'box-divider', w: 240, h: 160, d: 90, unit: 'mm', fold: true,
          dims: {
            width: '宽 240 mm', depth: '深 160 mm', height: '高 90 mm',
            note: '底板 240 × 160（宽 × 深）；两块立板各 240 × 90（宽 × 高）'
          },
          labels: ['底板 240 × 160（宽 × 深）', '立板高 90', '虚线 = 折叠线 / 三等分插口']
        },
        materials: [
          ORIGIN('瓦楞纸箱板'),
          M('纸胶带', '约 30 cm', 2, { note: '按一卷 6 元折算' }),
          M('白胶', '少量', 3, { optional: true, requires: ['glue'], note: '可选加固，去掉也能成型' }),
          M('包装纸边角料', '1 片', 0, { optional: true, note: '贴面用，没有就露瓦楞原色' })
        ],
        steps: [
          S('压平纸箱、定好尺寸', [
            V(['ruler', 'pencil'], '用尺子和铅笔标出底板 240（宽）× 160（深）mm，两块立板各 240（宽）× 90（高）mm', 4),
            V(['pencil'], '没有尺子就用铅笔比着现有书本边缘划线，宽深高按 240 : 160 : 90 的比例，尺寸不必精确', 4),
            V(['hands'], '不划线，直接沿纸箱自带的压痕定位板件，宽、深、高随原箱变化', 3, '形状会随原箱变化')
          ]),
          S('分出板件', [
            V(['cutter', 'ruler'], '用美工刀贴着尺子裁开，边缘最平整', 5),
            V(['scissors'], '用剪刀沿划线剪开纸板', 6),
            V(['hands'], '沿原有压痕反复折压后徒手撕开，不借助刀具', 8, '边缘不整齐，后续需收边')
          ]),
          S('折出底板与两块立板', [
            V(['hands'], '把 240 × 160 mm 底板平放，沿压痕向内折 90°，立起两块高 90 mm 的立板互相顶住', 4)
          ]),
          S('固定三格连接处', [
            V(['glue', 'tape'], '沿 240 mm 宽方向三等分（每格约 80 mm），立板底部涂白胶，外侧再贴一道纸胶带加固', 6),
            V(['tape'], '沿 240 mm 宽方向三等分（每格约 80 mm），只用纸胶带把立板底部与底板贴牢，不用胶水', 5),
            V(['scissors'], '沿 240 mm 宽方向三等分（每格约 80 mm），在立板底部剪出插舌、底板压出插口，折插卡紧，不用胶和胶带', 9),
            V(['hands'], '沿 240 mm 宽方向三等分（每格约 80 mm），把立板向内折成三角支撑，靠折角互相卡住，不用任何粘接材料', 8, '稳固度较低，只放轻物')
          ]),
          S('收边并试放', [
            V(['hands'], '把毛边向内折一层，放入纸张与充电线，确认每格约 80 mm 宽、立板 90 mm 高够用', 3)
          ])
        ],
        notes: ['纸板遇潮会变软，别放在水槽边。', '承重未验证，只放纸张、线材等轻物。']
      },
      {
        id: 'carton-aesthetic',
        lane: 'aesthetic',
        title: '拼色几何浮雕挂画',
        result: '瓦楞原色几何浮雕',
        summary: '把箱板裁成大小不同的三角与梯形，沿中线折出脊线，拼成有阴影的墙面小画。',
        diagram: { type: 'flat-mosaic', w: 300, h: 220, unit: 'mm', fold: true, labels: ['外框 300 × 220', '三角形模块 6 片', '虚线 = 折叠脊线'] },
        materials: [
          ORIGIN('瓦楞纸箱板'),
          M('丙烯颜料 / 彩笔', '少量', 5, { optional: true, requires: ['paint'], note: '不上色也成立' }),
          M('纸胶带', '约 20 cm', 2, { optional: true, requires: ['tape'] }),
          M('旧包装纸边角', '1 片', 0, { optional: true })
        ],
        steps: [
          S('裁出 6 片几何模块', [
            V(['cutter', 'ruler'], '用美工刀与尺子裁出 3 个三角、3 个梯形，边长控制在 60–100 mm', 8),
            V(['scissors'], '用剪刀剪出大小不同的三角与梯形，边缘略歪更有手作感', 8),
            V(['hands'], '沿原箱压痕徒手撕出不规则纸片，不追求几何规整', 6, '成品更接近拼贴而非几何画')
          ]),
          S('折出浮雕脊线', [
            V(['hands'], '把每片沿中线向内折一道，立起来时会产生明暗面', 5)
          ]),
          S('定色', [
            V(['paint'], '只给三角面薄薄上一层色，梯形保留瓦楞原色', 10),
            V(['hands'], '不上色，用瓦楞断面、里外面色差做层次', 1, '整体是素色')
          ]),
          S('排布并固定', [
            V(['glue', 'tape'], '用白胶点粘模块，背面贴纸胶带补强', 6),
            V(['tape'], '只用纸胶带从背面贴住，不用胶水', 5),
            V(['scissors'], '在模块与底板上剪出对应插口，互相折插固定', 9),
            V(['hands'], '不粘不挂，把模块平铺在桌面或窗台摆成一幅可随时改的构图', 2, '改为平摆，不上墙')
          ]),
          S('上墙或靠放', [
            V(['string', 'tape'], '背面贴一段麻绳做挂环，挂在现有挂钩上', 4),
            V(['hands'], '直接斜靠在书架或桌面，不额外打孔', 1)
          ], true)
        ],
        notes: ['只做轻量纸面装饰，不挂重物。', '若要粘上墙面，先确认墙面可移除胶带不留痕。']
      },
      {
        id: 'carton-wild',
        lane: 'wild',
        title: '斜折纸板弹珠轨道',
        result: '可手调坡道的滚珠轨道',
        summary: '一块斜板加两道折起的挡板，用折线做障碍，让一颗旧纽扣从顶端滚到底。',
        diagram: { type: 'ramp', w: 320, h: 200, unit: 'mm', fold: true, labels: ['斜板 320 × 200', '上端垫高约 50', '虚线 = 折边挡板'] },
        materials: [
          ORIGIN('瓦楞纸箱板'),
          M('旧纽扣 / 玻璃珠', '1 颗', 1, { optional: true, note: '家里有就是 0 元' }),
          M('纸胶带', '约 20 cm', 2, { optional: true, requires: ['tape'] })
        ],
        steps: [
          S('裁出斜板', [
            V(['cutter', 'ruler'], '用美工刀裁出 320 × 200 mm 的长方形板', 5),
            V(['scissors'], '用剪刀剪出一块长方形板，尺寸接近即可', 6),
            V(['hands'], '直接取整片箱盖当斜板，不裁切', 2, '尺寸随原箱')
          ]),
          S('折起两侧挡板', [
            V(['hands'], '沿长边各折起约 25 mm 做护栏，折角处用手压实', 4)
          ]),
          S('做折线障碍', [
            V(['scissors'], '在板面剪几道短口，向上折出小挡片，改变滚动路线', 6),
            V(['hands'], '把板面横向折出两道浅脊，靠坡度变化让珠子减速', 4, '路线变化较少')
          ]),
          S('垫高上端', [
            V(['hands'], '用一两本现有书本把上端垫高约 50 mm，下端落地', 2)
          ]),
          S('试滚并调整', [
            V(['hands'], '放珠子滚一次，卡住就压低挡片，太快就把上端放低一点', 5)
          ])
        ],
        notes: ['只用轻的珠子或纽扣，不要放重物。', '纸板坡道不承重，别让人踩或坐。']
      }
    ]
  },

  bottle: {
    id: 'bottle',
    name: '透明饮料瓶',
    material: 'PET 塑料（饮料瓶）',
    hint: '先洗净晾干、去掉标签',
    plans: [
      {
        id: 'bottle-practical',
        lane: 'practical',
        title: '桌面小件收纳筒',
        result: '桌面小件筒（敞口筒或整瓶高筒）',
        summary: '利用瓶身原有圆筒形状放笔、发圈、数据线：有条件收边时环切成敞口筒；没有收边条件就保留整瓶当高筒，不留锋利切口。',
        diagram: { type: 'cylinder', w: 70, h: 140, unit: 'mm', fold: false, labels: ['瓶身 Ø70', '截高约 140', '切口需包边'] },
        materials: [
          ORIGIN('透明饮料瓶'),
          M('纸胶带 / 布基胶带', '约 20 cm', 2, { optional: true, requires: ['tape'], note: '用来包住切口' }),
          M('双面胶贴', '2 片', 2, { optional: true, requires: ['tape'] }),
          M('旧布头', '1 小片', 0, { optional: true, note: '垫底防滑，可有可无' })
        ],
        steps: [
          S('清洗去标', [
            V(['hands'], '撕掉标签，用清水冲净内部并完全晾干', 6)
          ]),
          S('做出敞口', [
            V(['cutter'], '用美工刀沿瓶肩下方环切一圈，留下约 140 mm 高的筒身', 6, null, { effect: 'cut' }),
            V(['scissors'], '用剪刀从瓶口斜着剪开，再沿一圈修齐', 7, null, { effect: 'cut' }),
            V(['hands'], '不裁切，只拧下瓶盖，直接把整瓶当高筒用', 1,
              '没有收边条件，改用整瓶：全程不裁切，不会留下锋利毛边；筒口较窄、较高，放不了短笔',
              { effect: 'noCut' })
          ]),
          S('处理切口边缘', [
            V(['tape', 'scissors'], '沿切口内侧贴一圈纸胶带，把毛边完全盖住', 5, null, { when: 'cut' }),
            V(['tape'], '沿切口内侧贴一圈纸胶带把毛边盖住，再用手摸一遍确认不刮手', 5, null, { when: 'cut' }),
            V(['scissors'], '再剪一圈把毛刺修掉，并用手摸一遍确认不刮手', 5, null, { when: 'cut' }),
            V(['hands'], '上一步没有裁切，瓶口保持原样；用手摸一遍原有瓶口确认光滑，把标签残胶擦净', 2, null, { when: 'noCut' })
          ]),
          S('固定位置', [
            V(['tape'], '底部贴两片双面胶，固定在桌面不滑动', 3),
            V(['hands'], '不固定，直接平放在桌面角落', 1)
          ]),
          S('试装', [
            V(['hands'], '放入笔与线材，确认重心不歪；太轻就在底部压一片旧布头', 2)
          ])
        ],
        notes: ['切口可能锋利，必须包边或修齐后再伸手进去取物。', 'PET 不耐热：别放热水、别靠近灶台与暖气，更不能用明火或加热塑形。', '不用来装食品、饮水或调味料；未知来源的瓶子不保证材质安全。'],
        // 走「不裁切」分支时，整个方案的展示信息一起换成整瓶版，避免图文互相矛盾。
        byEffect: {
          noCut: {
            title: '带盖整瓶高筒',
            result: '原瓶直接用的带盖高筒',
            summary: '全程不裁切：拧下瓶盖，把整只透明饮料瓶当高筒，放长笔、发圈与数据线；瓶口是原厂边缘，不需要包边或修边。',
            diagram: { type: 'cylinder', w: 70, h: 230, unit: 'mm', fold: false, whole: true, labels: ['整瓶保留 · 不裁切', '原厂瓶口，无需包边', '瓶盖可拧开取物'] },
            stepLabels: { '做出敞口': '改用整瓶', '处理切口边缘': '检查原瓶口', '试装': '试装与取放' },
            materialNotes: { '透明饮料瓶': '整瓶保留，不裁切，不计费用' },
            notes: [
              '没有裁切，瓶口是原厂边缘；取物前用手摸一遍确认无毛刺即可，不需要包边。',
              'PET 不耐热：别放热水、别靠近灶台与暖气，更不能用明火或加热塑形。',
              '不用来装食品、饮水或调味料；未知来源的瓶子不保证材质安全。'
            ]
          }
        }
      },
      {
        id: 'bottle-aesthetic',
        lane: 'aesthetic',
        title: '瓶底花瓣光影挂串',
        result: '窗边折射光影挂饰',
        summary: '把瓶底的五瓣弧度剪成花瓣片，串起来挂在窗边，光穿过透明塑料会投出浅浅的影。',
        diagram: { type: 'hang', w: 260, h: 300, unit: 'mm', fold: true, labels: ['挂绳长约 300', '花瓣片 5 枚', '虚线 = 折弯线'] },
        materials: [
          ORIGIN('透明饮料瓶'),
          M('细麻绳 / 旧鞋带', '约 40 cm', 2, { optional: true, requires: ['string'] }),
          M('纸胶带', '约 15 cm', 1, { optional: true, requires: ['tape'] })
        ],
        steps: [
          S('取下瓶底弧片', [
            V(['cutter'], '用美工刀沿瓶底上方 30 mm 环切，得到带五瓣弧度的圆片', 6, null, { effect: 'cut' }),
            V(['scissors'], '用剪刀沿瓶底轮廓剪下弧片，再把边缘修圆', 8, null, { effect: 'cut' }),
            V(['hands'], '不剪不切，保留整瓶，直接用瓶身竖排做光影摆件', 2,
              '没有条件给裁下的弧片修边，改用不裁切的整瓶摆件，没有花瓣片，也不打孔穿绳', { effect: 'noCut' })
          ]),
          S('分成花瓣并修形', [
            V(['scissors'], '沿五瓣凹口剪开成单片，每片再修掉尖角', 7, null, { when: 'cut' }),
            V(['hands'], '上一步没有裁切，整瓶保持原样，不做花瓣片；直接摆成竖排', 1, null, { when: 'noCut' })
          ]),
          S('做连接点', [
            V(['punch', 'string'], '用打孔器在每片顶端打孔，穿麻绳打结', 6, null, { when: 'cut' }),
            V(['tape', 'string'], '不打孔，用纸胶带把麻绳贴在花瓣背面', 5, null, { when: 'cut' }),
            V(['hands'], '不打孔也不穿绳，把花瓣片平铺在窗台排成一列', 1, '不上墙', { when: 'cut' }),
            V(['hands'], '上一步没有裁切，也就没有花瓣片；不用打孔穿绳，把整瓶竖排在窗台', 1, null, { when: 'noCut' })
          ]),
          S('排布与悬挂', [
            V(['string'], '把花瓣按长短错开串好，挂在现有窗帘杆或挂钩上', 5, null, { when: 'cut' }),
            V(['hands'], '沿窗台摆好，退一步看看光斑位置', 2)
          ], true),
          S('检查', [
            V(['hands'], '轻碰一下确认不会掉；透明塑料别贴在朝阳高温玻璃上', 2)
          ])
        ],
        notes: ['挂饰很轻，只用细绳，不挂重物。', '塑料不可加热、不可燃烧、不可靠近明火与高温玻璃。', '不做食品容器，也不装液体。'],
        byEffect: {
          noCut: {
            title: '整瓶窗台光影摆件',
            result: '窗台折射光影摆件',
            summary: '不裁切、不取瓶底弧片：把整瓶竖排放在窗台，借透明瓶身折出的光斑做摆件，没有花瓣片，也不打孔穿绳。',
            diagram: { type: 'hang', w: 70, h: 230, unit: 'mm', fold: false, whole: true, labels: ['整瓶竖排 · 不裁切', '没有花瓣片与挂绳', '平放窗台，不上墙'] },
            stepLabels: {
              '取下瓶底弧片': '改用整瓶摆件',
              '分成花瓣并修形': '整瓶保持原样',
              '做连接点': '不做连接点',
              '排布与悬挂': '窗台竖排',
              '检查': '摆放检查'
            },
            materialNotes: { '透明饮料瓶': '整瓶保留，不裁切，不计费用' },
            notes: [
              '整瓶竖排是桌面 / 窗台摆件：没有花瓣片，也不打孔、不穿绳、不上墙。',
              '塑料不可加热、不可燃烧、不可靠近明火与高温玻璃。',
              '不做食品容器，也不装液体。'
            ]
          }
        }
      },
      {
        id: 'bottle-wild',
        lane: 'wild',
        title: '瓶中微型旱景罩',
        result: '不加水的透明微景观',
        summary: '瓶身当透明罩，里面只放干石子和折纸小景，做成一个不用浇水、不密封的小摆件。',
        diagram: { type: 'terrarium', w: 90, h: 180, unit: 'mm', fold: false, labels: ['罩高约 180', '底座 Ø90', '干石 + 纸景'] },
        materials: [
          ORIGIN('透明饮料瓶'),
          M('小石子 / 干豆子', '一小把', 0, { optional: true, note: '家里现有即可' }),
          M('废纸片', '1 张', 0, { optional: true })
        ],
        steps: [
          S('准备透明罩', [
            V(['cutter'], '用美工刀环切瓶身，取中段透明圆筒当罩', 6, null, { effect: 'cut' }),
            V(['scissors'], '用剪刀剪开瓶身取一段透明筒，边缘修齐', 7, null, { effect: 'cut' }),
            V(['hands'], '不裁切，整瓶竖放、拧下瓶盖，从瓶口投入材料', 2,
              '没有条件给切开的筒身收边，改用不裁切的整瓶，从瓶口投入材料；摆件更高更窄', { effect: 'noCut' })
          ]),
          S('铺底层', [
            V(['hands'], '从瓶口放进一小把干石子，铺平当「地面」', 3)
          ]),
          S('折一个小景', [
            V(['hands'], '把废纸片折成小三角当「山」，卡在石子上', 5)
          ]),
          S('合罩', [
            V(['tape', 'scissors'], '把透明段扣在底座上，接缝处贴两小段纸胶带', 4, null, { when: 'cut' }),
            V(['tape'], '把透明段扣在底座上，接缝处贴两小段纸胶带', 4, null, { when: 'cut' }),
            V(['hands'], '上一步没有裁切，直接把整瓶放回原处，瓶盖不拧紧、保持可打开', 1, '不密封', { when: 'noCut' })
          ]),
          S('摆放', [
            V(['hands'], '放在散射光桌面，不加水、不种活体、不晒太阳', 2)
          ])
        ],
        notes: ['不加水、不密封、不装活体；密封加压容器不做。', 'PET 不耐热，远离窗台高温与明火。', '纯观赏摆件，不承重、不防水、不接触食品。'],
        byEffect: {
          noCut: {
            title: '整瓶微型旱景',
            result: '不加水的整瓶微景观',
            summary: '不裁切瓶身：从瓶口投入干石子与折纸小景，整瓶就是微景观容器，瓶盖保持可打开、不密封。',
            diagram: { type: 'terrarium', w: 70, h: 230, unit: 'mm', fold: false, whole: true, labels: ['整瓶保留 · 不裁切', '从瓶口投入干石与纸景', '瓶盖不拧紧，不密封'] },
            stepLabels: { '准备透明罩': '改用整瓶', '铺底层': '从瓶口铺底层', '合罩': '放回瓶盖' },
            materialNotes: { '透明饮料瓶': '整瓶保留，不裁切，不计费用' },
            notes: [
              '不加水、不密封、不装活体；瓶盖保持可打开，密封加压容器不做。',
              'PET 不耐热，远离窗台高温与明火。',
              '纯观赏摆件，不承重、不防水、不接触食品。'
            ]
          }
        }
      }
    ]
  },

  tshirt: {
    id: 'tshirt',
    name: '旧棉 T 恤',
    material: '棉针织布',
    hint: '洗过、干燥、无油污',
    plans: [
      {
        id: 'tshirt-practical',
        lane: 'practical',
        title: '免缝打结束口袋',
        result: '不用针线的软布收纳袋',
        summary: '取 T 恤躯干段，下摆剪出流苏两两打结收底，抽一根布条当束口，全程不用针线。',
        diagram: { type: 'fabric', w: 260, h: 320, unit: 'mm', fold: true, labels: ['袋身 260 × 320', '下摆剪口深 40', '虚线 = 折边'] },
        materials: [
          ORIGIN('旧棉 T 恤'),
          M('布条 / 旧鞋带', '约 40 cm', 0, { optional: true, note: '从袖口剪一条即可' }),
          M('细丝带', '约 40 cm', 2, { optional: true, requires: ['string'] })
        ],
        steps: [
          S('取下躯干段', [
            V(['scissors'], '沿袖窿下方剪开，取中间一段完整布筒', 5),
            V(['hands'], '不裁剪，直接把整件 T 恤的领口当袋口、袖子向内塞', 2, '袋子更大、形状不规则')
          ]),
          S('翻面与定底', [
            V(['hands'], '把布筒翻到反面，抚平下摆，确认底边位置', 3)
          ]),
          S('收底', [
            V(['scissors'], '下摆每 20 mm 剪一道 40 mm 深的口，前后两片对应流苏两两打死结', 12),
            V(['hands'], '不剪不缝，把下摆向内卷折三圈塞紧，靠布料自身摩擦收底', 5, '底部会鼓，装轻物才稳')
          ]),
          S('做束口', [
            V(['scissors', 'string'], '从袖口剪一条 40 cm 布条，穿过领口罗纹来回抽一遍打结', 6),
            V(['string'], '用现成细丝带穿过领口罗纹当抽绳', 4),
            V(['hands'], '不做抽绳，把领口向外翻卷两圈直接敞口使用', 2, '不能束紧')
          ]),
          S('试装', [
            V(['hands'], '装进袜子或充电线，提起来晃一下，看底部结是否松开', 3)
          ])
        ],
        notes: ['针织布会脱线，边缘不锁边属正常；只装轻物。', '不承重、不防水，别装尖锐或带液体物品。']
      },
      {
        id: 'tshirt-aesthetic',
        lane: 'aesthetic',
        title: '三股布条编织挂旗',
        result: '原色布条编织挂饰',
        summary: '把 T 恤撕成三条长布带，编成一条粗辫，两头打结挂在旧纸板上，颜色全来自衣服本身。',
        diagram: { type: 'weave', w: 180, h: 260, unit: 'mm', fold: true, labels: ['布条宽约 20', '三股编长 260', '虚线 = 折边'] },
        materials: [
          ORIGIN('旧棉 T 恤'),
          M('硬纸片 / 旧筷子', '1 根', 0, { optional: true, note: '当挂杆，家里有就行' }),
          M('细麻绳', '约 20 cm', 1, { optional: true, requires: ['string'] })
        ],
        steps: [
          S('取布条', [
            V(['scissors'], '从下摆向上剪出 3 条约 20 mm 宽的长布带', 6),
            V(['hands'], '从下摆剪口处徒手撕出 3 条布带，边缘自然起毛', 6, '布条宽度不匀')
          ]),
          S('三股编', [
            V(['hands'], '三条并排打一个起始结，左右交替向中间编到约 260 mm 长', 12)
          ]),
          S('收尾', [
            V(['hands'], '末端打一个死结，把散开的线头向内塞进辫子', 3)
          ]),
          S('上杆', [
            V(['string'], '两端用细麻绳绑在硬纸片或旧筷子上，挂到现有挂钩', 5),
            V(['hands'], '不绑杆，直接把辫子绕成圈平放在桌面当装饰', 1, '改为平摆')
          ], true),
          S('修齐', [
            V(['scissors'], '剪掉过长的线头，保留一点毛边', 3),
            V(['hands'], '把线头拧进辫子里，不修剪', 2)
          ], true)
        ],
        notes: ['布辫不承重，只做视觉装饰。', '远离明火与热源；针织布易燃，不做灯罩或隔热垫。']
      },
      {
        id: 'tshirt-wild',
        lane: 'wild',
        title: '手持布叶风车',
        result: '跑起来会转的布风车',
        summary: '四片布叶折插在纸板中心，套在铅笔上，举着走两步它就转；没有电、没有电池。',
        diagram: { type: 'pinwheel', w: 160, h: 160, unit: 'mm', fold: true, labels: ['叶片 4 片 各 70', '中心折插孔', '虚线 = 对折线'] },
        materials: [
          ORIGIN('旧棉 T 恤'),
          M('硬纸片 / 纸箱边角', '1 小片', 0, { optional: true, note: '当中心垫片' }),
          M('铅笔 / 旧筷子', '1 根', 1, { optional: true }),
          M('纸胶带', '约 10 cm', 1, { optional: true, requires: ['tape'] })
        ],
        steps: [
          S('裁四片方布', [
            V(['scissors', 'ruler'], '量出 4 块 70 × 70 mm 的方布', 6),
            V(['scissors'], '剪出 4 块大小接近的方布', 5),
            V(['hands'], '徒手撕出 4 片近似方形布片', 5, '叶片不规整，转动会偏')
          ]),
          S('折出四叶', [
            V(['hands'], '每片沿对角折一次，四个折角朝同一方向叠成风车状', 6)
          ]),
          S('固定中心', [
            V(['punch', 'string'], '中心打孔后用细绳穿过打个活结，留出转动余量', 6),
            V(['tape'], '用一小段纸胶带把四片中心贴在一起，不粘死轴心', 4),
            V(['hands'], '把四片折角互相插进对方的折缝里，靠折插固定', 5, '转几圈可能松开，需重新插')
          ]),
          S('装柄', [
            V(['hands'], '把中心卡在铅笔或旧筷子顶端，能自由转动即可', 4)
          ]),
          S('试转', [
            V(['hands'], '举着慢走两步看是否转动；卡住就放松中心，别用力甩', 3)
          ])
        ],
        notes: ['只手持轻转，不靠近风扇、明火与高温。', '布叶不承重，别当支撑件或玩具给幼儿啃咬。']
      }
    ]
  }
};

// 难度是人工判断的制作门槛，不是由公式假装算出来的精确值。
const DIFFICULTY = {
  'carton-practical': '入门', 'carton-aesthetic': '进阶', 'carton-wild': '进阶',
  'bottle-practical': '入门', 'bottle-aesthetic': '进阶', 'bottle-wild': '挑战',
  'tshirt-practical': '进阶', 'tshirt-aesthetic': '入门', 'tshirt-wild': '挑战'
};
for (const sample of Object.values(SAMPLES)) {
  for (const plan of sample.plans) plan.difficulty = DIFFICULTY[plan.id] || '入门';
}

const SAMPLE_META = Object.values(SAMPLES).map((s) => ({
  id: s.id, name: s.name, material: s.material, hint: s.hint
}));

// --- 预算/工具都不满足时的可行替代：0 元、徒手、但明确不是原方案 -----------
function fallbackPlans(item) {
  const name = item || '这件闲置物';
  return [
    {
      id: 'fallback-practical', lane: 'practical', isFallback: true, difficulty: '入门',
      title: '不花钱的分类位', result: '原物直接当分类容器',
      summary: `不改动 ${name}，先给它找一个固定位置，用原有折痕或形状分区，把零散小件归进去。`,
      diagram: { type: 'flat-mosaic', w: 200, h: 140, unit: 'mm', fold: true, labels: ['原物原位', '按形状分区', '虚线 = 原有折痕'] },
      materials: [ORIGIN(name)],
      steps: [
        S('清灰', [V(['hands'], '把表面擦干净、完全晾干', 3)]),
        S('定位', [V(['hands'], '找一个固定的桌面或架位，不再随手挪动', 2)]),
        S('分区', [V(['hands'], '利用原有折痕、开口或形状分出两三个区域', 3)]),
        S('试放', [V(['hands'], '放入轻的小件，确认不会倾倒', 2)])
      ],
      notes: ['这是「不改动」的替代做法，不是原本那套改造方案。', '承重与防水未验证。']
    },
    {
      id: 'fallback-aesthetic', lane: 'aesthetic', isFallback: true, difficulty: '入门',
      title: '换个朝向的摆位卡', result: '原色静物摆位',
      summary: `不裁不粘，把 ${name} 换个朝向、挪到散射光下，先看看它本来的样子。`,
      diagram: { type: 'flat-mosaic', w: 200, h: 140, unit: 'mm', fold: false, labels: ['原物', '侧光位', '留白背景'] },
      materials: [ORIGIN(name)],
      steps: [
        S('擦净', [V(['hands'], '擦掉浮灰，保留原有使用痕迹', 3)]),
        S('找光', [V(['hands'], '挪到窗边散射光处，避开直射高温', 2)]),
        S('摆位', [V(['hands'], '转两个角度，选一个轮廓最清楚的方向', 3)]),
        S('退一步看', [V(['hands'], '留出周围空白，别堆别的东西', 1)])
      ],
      notes: ['这是「不改动」的替代做法，不产生新物件。']
    },
    {
      id: 'fallback-wild', lane: 'wild', isFallback: true, difficulty: '入门',
      title: '用途接龙', result: '五个不改动的新用途',
      summary: `先不动 ${name}，给自己出五个用途点子，挑一个真的试一次，再决定要不要动刀。`,
      diagram: { type: 'flat-mosaic', w: 200, h: 140, unit: 'mm', fold: false, labels: ['原物', '5 个用途', '挑 1 个试'] },
      materials: [ORIGIN(name), M('随手纸片', '1 张', 0, { optional: true, note: '没有就只在心里列' })],
      steps: [
        S('观察', [V(['hands'], '把原物转一圈，记下开口、平面、弧度各在哪', 3)]),
        S('列五个用途', [V(['hands'], '在心里或随手纸片上写下五个用途，先不管能不能做', 4)]),
        S('挑一个', [V(['hands'], '选不需要额外工具与花费的那一个', 2)]),
        S('试一次', [V(['hands'], '真的用一次，再决定要不要继续改造', 3)])
      ],
      notes: ['这是「先不改」的替代做法，不是实物成品。']
    }
  ];
}

// --- 示例模式下用户自己描述的新物品：规则模板，不冒充识图 -------------------
function genericPlans(item, material) {
  const name = item || '这件物品';
  const mat = material || '未填写材质';
  const materialNote = `材质按你填写的「${mat}」处理；未核实的材质不保证安全、承重与防水。`;
  const base = fallbackPlans(name);
  return base.map((p, i) => Object.assign({}, p, {
    id: `generic-${p.lane}`,
    isFallback: false,
    isGeneric: true,
    title: ['给它一个固定位置', '换个角度摆一次', '先想五个用途'][i],
    result: ['不改动就能用的收纳位', '原色静物摆位', '五个用途点子'][i],
    summary: (['先不改动结构，给 ', '不裁不粘，把 ', '先不动手，给 '][i]) + name + ([' 找一个固定位置并把零散小件归进去。', ' 换个朝向、挪到散射光下看看本来的样子。', ' 出五个用途点子，挑一个零成本的真试一次。'][i]),
    notes: [materialNote, '示例模式：以上是按你填写的描述生成的规则示例，不是图像识别结果。']
  }));
}

module.exports = {
  TOOLS, TOOL_IDS, TOOL_LABELS, DEFAULT_TOOLS, LANES,
  SAMPLES, SAMPLE_META, fallbackPlans, genericPlans
};
