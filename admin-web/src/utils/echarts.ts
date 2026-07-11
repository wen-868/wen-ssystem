/**
 * echarts 按需导入封装模块
 * 只导入项目中实际使用的图表类型和组件，减小打包体积
 */
import * as echarts from 'echarts/core'

// 图表类型：项目使用 bar/line/pie/scatter/funnel/heatmap
import { BarChart, LineChart, PieChart, ScatterChart, FunnelChart, HeatmapChart } from 'echarts/charts'

// 组件：项目使用 title/tooltip/legend/grid/visualMap/markLine
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
  MarkLineComponent,
} from 'echarts/components'

// 渲染器：Canvas
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  // 图表
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  FunnelChart,
  HeatmapChart,
  // 组件
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  VisualMapComponent,
  MarkLineComponent,
  // 渲染器
  CanvasRenderer,
])

export default echarts
export { echarts }
