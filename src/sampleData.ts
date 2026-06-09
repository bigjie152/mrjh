import { DailyPlannerEntry, WEEKDAYS } from './types';

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateString(dateStr: string, dayOffset: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + dayOffset);
  return getLocalDateString(date);
}

export function getWeekDayName(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return WEEKDAYS[date.getDay()];
}

export function formatMinutes(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}小时${mins > 0 ? `${mins}分钟` : ''}`;
  }
  return `${mins}分钟`;
}

export function formatSignedMinutes(minutes: number): string {
  if (minutes === 0) return formatMinutes(0);
  return `${minutes > 0 ? '+' : '-'}${formatMinutes(Math.abs(minutes))}`;
}

export function calculateTimeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  
  const startTotal = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  
  // Handle cross-midnight if applicable, but keep standard duration in 24h
  if (endTotal >= startTotal) {
    return endTotal - startTotal;
  } else {
    return (24 * 60 - startTotal) + endTotal; // cross midnight
  }
}

export const initialSampleData: DailyPlannerEntry[] = [
  {
    date: '2026-05-25',
    weekDay: '星期一',
    tasks: [
      { id: 1, text: '撰写《情商力》草稿文章', completed: true, category: 'learning', notes: '完成了3000字核心章节。' },
      { id: 2, text: '阅读《今日简史》第二章', completed: true, category: 'learning', notes: '精读了15页并高亮重要句段。' },
      { id: 3, text: '每日反思与日记复盘', completed: true, category: 'learning', notes: '结合早晨梦境完成了认知校准。' },
      { id: 4, text: '取顺丰速运快递与下午茶', completed: true, category: 'life', notes: '顺畅，也顺便散步。' },
      { id: 5, text: '备忘录标题配图与插画制作', completed: true, category: 'work', notes: '完成了2张设计并导出。' },
      { id: 6, text: '网购周五回家高铁票', completed: true, category: 'life', notes: '抢票成功。' },
    ],
    plannedBlocks: [
      {
        id: 'p-1',
        startTime: '05:30',
        endTime: '06:30',
        taskRef: null,
        content: '跑步与洗漱晨练',
        category: 'sport',
        estimatedMinutes: 60,
      },
      {
        id: 'p-2',
        startTime: '06:30',
        endTime: '07:30',
        taskRef: 2,
        content: '主读《今日简史》',
        category: 'learning',
        estimatedMinutes: 60,
      },
      {
        id: 'p-3',
        startTime: '08:30',
        endTime: '10:00',
        taskRef: null,
        content: '高管季度战略远程会议',
        category: 'work',
        estimatedMinutes: 90,
      },
      {
        id: 'p-4',
        startTime: '10:00',
        endTime: '11:30',
        taskRef: 5,
        content: '插画排版配图绘制',
        category: 'work',
        estimatedMinutes: 90,
      },
      {
        id: 'p-5',
        startTime: '11:50',
        endTime: '12:30',
        taskRef: null,
        content: '在线社交与手机信息复盘',
        category: 'other',
        estimatedMinutes: 40,
      },
      {
        id: 'p-6',
        startTime: '12:30',
        endTime: '13:00',
        taskRef: null,
        content: '常规午休调整状态',
        category: 'life',
        estimatedMinutes: 30,
      },
      {
        id: 'p-7',
        startTime: '13:00',
        endTime: '15:00',
        taskRef: 1,
        content: '写《情商力》专栏文章',
        category: 'learning',
        estimatedMinutes: 120,
      },
      {
        id: 'p-8',
        startTime: '15:00',
        endTime: '16:30',
        taskRef: null,
        content: '与甲方核定签订补充合同',
        category: 'work',
        estimatedMinutes: 90,
      },
      {
        id: 'p-9',
        startTime: '16:30',
        endTime: '17:30',
        taskRef: 6,
        content: '下午茶与定周五高铁票',
        category: 'life',
        estimatedMinutes: 60,
      },
    ],
    actualBlocks: [
      {
        id: 'a-1',
        startTime: '05:50',
        endTime: '07:00',
        taskRef: null,
        content: '跑步与洗漱晨练',
        category: 'sport',
        actualMinutes: 70,
        reason: '早晨起身体重偏沉，出门略迟。',
      },
      {
        id: 'a-2',
        startTime: '07:00',
        endTime: '07:35',
        taskRef: 2,
        content: '阅读《今日简史》',
        category: 'learning',
        actualMinutes: 35,
        reason: '因跑步时间延后，被迫压缩了阅读时间。',
      },
      {
        id: 'a-3',
        startTime: '08:30',
        endTime: '10:00',
        taskRef: null,
        content: '高管季度战略远程会议',
        category: 'work',
        actualMinutes: 90,
      },
      {
        id: 'a-4',
        startTime: '10:00',
        endTime: '11:30',
        taskRef: 5,
        content: '插画排版配图绘制',
        category: 'work',
        actualMinutes: 90,
      },
      {
        id: 'a-5',
        startTime: '11:50',
        endTime: '12:30',
        taskRef: null,
        content: '在线社交与手机信息复盘',
        category: 'other',
        actualMinutes: 40,
      },
      {
        id: 'a-6',
        startTime: '12:30',
        endTime: '13:00',
        taskRef: null,
        content: '午睡休息',
        category: 'life',
        actualMinutes: 30,
      },
      {
        id: 'a-7',
        startTime: '13:00',
        endTime: '16:00',
        taskRef: 1,
        content: '写《情商力》草稿与精加',
        category: 'learning',
        actualMinutes: 180,
        reason: '因状态爆棚、文思泉涌，自主选择多写1小时，深度心流。',
      },
      {
        id: 'a-8',
        startTime: '16:00',
        endTime: '17:30',
        taskRef: null,
        content: '延迟签署甲方补充合同',
        category: 'work',
        actualMinutes: 90,
        reason: '受上个深度写作事项延时的连锁反应影响。',
      },
      {
        id: 'a-9',
        startTime: '17:30',
        endTime: '18:10',
        taskRef: 6,
        content: '取快递与订妥高铁票',
        category: 'life',
        actualMinutes: 40,
        reason: '手续精练，实际比计划缩短了20分钟。',
      },
    ],
    review: {
      biggestDeviation: '专栏文章撰写由于状态太好延长了60分钟。跑步晚了20分钟导致阅读被压缩25分钟。',
      improvement: '对创作类高心流任务，在计划表里应该额外留20-30分钟缓冲，不要卡死下一个刚性合同。',
      generalNotes: '总体拟合率极高，时间高阶利用，非常满意今天的心流状态！',
    },
  },
  {
    date: '2026-05-24',
    weekDay: '星期日',
    tasks: [
      { id: 1, text: '整理下周工作重点大纲', completed: true, category: 'work', notes: '梳理了3个新项目' },
      { id: 2, text: '户外骑行 20 公里', completed: true, category: 'sport', notes: '完成了，消耗550大卡' },
      { id: 3, text: '购买生鲜与家庭大扫除', completed: true, category: 'life' },
      { id: 4, text: '未作额外硬性任务', completed: false, category: 'leisure' },
      { id: 5, text: '', completed: false, category: 'other' },
      { id: 6, text: '', completed: false, category: 'other' },
    ],
    plannedBlocks: [
      { id: 'p24-1', startTime: '09:00', endTime: '11:00', taskRef: 2, content: '绿道自行车骑行', category: 'sport', estimatedMinutes: 120 },
      { id: 'p24-2', startTime: '14:00', endTime: '16:00', taskRef: 3, content: '采购生鲜与全屋吸尘', category: 'life', estimatedMinutes: 120 },
      { id: 'p24-3', startTime: '16:30', endTime: '18:00', taskRef: 1, content: '工作事务大纲梳理', category: 'work', estimatedMinutes: 90 },
    ],
    actualBlocks: [
      { id: 'a24-1', startTime: '09:00', endTime: '11:30', taskRef: 2, content: '绿道自行车骑行', category: 'sport', actualMinutes: 150, reason: '天气太好，多骑了5公里。' },
      { id: 'a24-2', startTime: '14:15', endTime: '15:45', taskRef: 3, content: '全屋清洁扫除', category: 'life', actualMinutes: 90, reason: '没有去买生鲜，改为线上送达。' },
      { id: 'a24-3', startTime: '16:30', endTime: '18:00', taskRef: 1, content: '下周战略重点梳理', category: 'work', actualMinutes: 90 },
    ],
    review: {
      biggestDeviation: '骑行因为天气舒适多运动了30分钟，大扫除使用买菜配送节省了30分钟。',
      improvement: '合理利用即时配送服务能腾出成块高质量闲暇，非常好。',
      generalNotes: '周末得到大松弛与大调整，恢复了核心效力。',
    },
  },
  {
    date: '2026-05-26', // 示例记录
    weekDay: '星期二',
    tasks: [
      { id: 1, text: '完成每日时间管理产品的前端页面开发', completed: false, category: 'work', notes: '需要包含高拟真手帐感UI' },
      { id: 2, text: '核心偏差算法与时间百分比统计', completed: false, category: 'work' },
      { id: 3, text: '模拟生成当天的仿真数据做可视化', completed: true, category: 'work', notes: '已撰写了sampleData.ts' },
      { id: 4, text: '去公园散步放松15分钟', completed: false, category: 'life' },
      { id: 5, text: '阅读技术文章2篇', completed: false, category: 'learning' },
      { id: 6, text: '记录今天的梦境和认知波动点', completed: false, category: 'learning' },
    ],
    plannedBlocks: [
      { id: 'p26-1', startTime: '06:00', endTime: '07:00', taskRef: null, content: '晨瑜伽与水合呼吸', category: 'sport', estimatedMinutes: 60 },
      { id: 'p26-2', startTime: '08:30', endTime: '12:00', taskRef: 1, content: 'UI极致质感研发与动画联调', category: 'work', estimatedMinutes: 210 },
      { id: 'p26-3', startTime: '13:30', endTime: '15:30', taskRef: 2, content: '统计面板与历史分析页编写', category: 'work', estimatedMinutes: 120 },
      { id: 'p26-4', startTime: '16:00', endTime: '17:00', taskRef: 4, content: '户外放空与散步', category: 'life', estimatedMinutes: 60 },
      { id: 'p26-5', startTime: '19:30', endTime: '21:00', taskRef: 5, content: '研读前沿设计范式与总结', category: 'learning', estimatedMinutes: 90 },
    ],
    actualBlocks: [
      { id: 'a26-1', startTime: '06:05', endTime: '06:55', taskRef: null, content: '晨起拉伸呼吸训练', category: 'sport', actualMinutes: 50 },
      { id: 'a26-2', startTime: '08:30', endTime: '12:15', taskRef: 1, content: '前端组件与排版质感硬岩攻坚', category: 'work', actualMinutes: 225, reason: '追求每个细节打磨，多花了15分钟，算在合理偏差内。' },
    ],
    review: {
      biggestDeviation: '',
      improvement: '',
      generalNotes: '今天正在专注于每日对照表的构建，下午实际待复盘补充。',
    },
  },
];
