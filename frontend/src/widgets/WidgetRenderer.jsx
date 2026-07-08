import ChartWidget from './ChartWidget.jsx';
import GaugeWidget from './GaugeWidget.jsx';
import MapWidget from './MapWidget.jsx';
import StatusCardWidget from './StatusCardWidget.jsx';
import AlarmListWidget from './AlarmListWidget.jsx';

function renderBody(widget, data) {
  switch (widget.type) {
    case 'chart':
      return <ChartWidget data={data} />;
    case 'gauge':
      return <GaugeWidget data={data} />;
    case 'map':
      return <MapWidget data={data} />;
    case 'status_card':
      return <StatusCardWidget data={data} />;
    case 'alarm_list':
      return <AlarmListWidget data={data} />;
    default:
      return <p>Unknown widget type</p>;
  }
}

export default function WidgetRenderer({ widget, data, error }) {
  return (
    <div className="widget">
      <h3>{widget.title}</h3>
      {error && <p className="error">{error}</p>}
      {!error && renderBody(widget, data)}
    </div>
  );
}
