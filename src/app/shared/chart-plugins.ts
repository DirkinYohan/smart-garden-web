import { ChartType, Plugin } from 'chart.js';

export interface VerticalMarker {
  x: number;
  label: string;
  color: string;
  dashed?: boolean;
}

declare module 'chart.js' {
  interface PluginOptionsByType<TType extends ChartType> {
    sgMarkers?: { markers: VerticalMarker[] };
    sgCenterText?: { text: string; sub?: string; color: string; subColor: string };
  }
}

export const verticalMarkersPlugin: Plugin = {
  id: 'sgMarkers',
  afterDatasetsDraw(chart, _args, options: { markers?: VerticalMarker[] }) {
    const markers = options?.markers ?? [];
    const x = chart.scales['x'];
    if (!x || !markers.length) return;
    const { ctx, chartArea } = chart;
    ctx.save();

    markers.forEach((m, i) => {
      const px = x.getPixelForValue(m.x);
      if (!Number.isFinite(px) || px < chartArea.left - 1 || px > chartArea.right + 1) return;
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(m.dashed ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(px, chartArea.top);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 11px Roboto, sans-serif';
      ctx.fillStyle = m.color;
      const width = ctx.measureText(m.label).width;
      const tx = Math.min(Math.max(px - width / 2, chartArea.left), chartArea.right - width);
      ctx.fillText(m.label, tx, chartArea.top + 12 + i * 14);
    });
    ctx.restore();
  },
};

export const centerTextPlugin: Plugin = {
  id: 'sgCenterText',
  afterDraw(chart, _args, options: { text?: string; sub?: string; color?: string; subColor?: string }) {
    if (!options?.text) return;
    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = options.color ?? '#222';
    ctx.font = '500 26px Roboto, sans-serif';
    ctx.fillText(options.text, cx, options.sub ? cy - 8 : cy);
    if (options.sub) {
      ctx.fillStyle = options.subColor ?? '#666';
      ctx.font = '12px Roboto, sans-serif';
      ctx.fillText(options.sub, cx, cy + 14);
    }
    ctx.restore();
  },
};
