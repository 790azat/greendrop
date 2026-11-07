import { Brand } from '@/components/Logo';

export const metadata = { title: 'Установить GreenDrop' };

export default function Install() {
  return (
    <div className="shell stack" style={{ paddingBottom: 40 }}>
      <div className="topbar"><a href="/" style={{ textDecoration: 'none' }}><Brand /></a></div>
      <h1>Установить на телефон</h1>
      <div className="card stack">
        <h3>iPhone (Safari)</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Откройте сайт именно в <b>Safari</b>.</li>
          <li>Нажмите кнопку <b>«Поделиться»</b> (квадрат со стрелкой вверх).</li>
          <li>Прокрутите и выберите <b>«На экран „Домой“»</b>.</li>
          <li>Нажмите <b>«Добавить»</b>. Иконка GreenDrop появится на рабочем столе и откроется как приложение.</li>
        </ol>
      </div>
      <div className="card stack">
        <h3>Android (Chrome)</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
          <li>Откройте сайт в <b>Chrome</b>.</li>
          <li>Нажмите меню <b>⋮</b> в правом верхнем углу.</li>
          <li>Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</li>
        </ol>
      </div>
      <a className="btn block" href="/">Вернуться</a>
    </div>
  );
}
