/**
 * echarts 按需导入封装（减小打包体积）
 *
 * saas-admin 实际只用折线/饼图/柱状图，全量引入 echarts 约 1.1MB；
 * 按需注册后体积降至约 1/3。新增图表类型时在此补充注册。
 */
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
]);

export default echarts;
export { echarts };
