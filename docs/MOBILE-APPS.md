# GreenDrop в App Store и Google Play

Приложение уже работает как PWA (иконка на экране «Домой»). Чтобы выложить его в магазины,
используем [Capacitor](https://capacitorjs.com): нативная оболочка открывает сайт
`https://greendrop-ten.vercel.app`, поэтому обновления сайта сразу попадают в приложение
без повторной публикации. Конфиг уже лежит в `capacitor.config.json`.

## Что понадобится

| | iPhone (App Store) | Android (Google Play) |
| --- | --- | --- |
| Компьютер | Mac с Xcode | любой, Android Studio |
| Аккаунт разработчика | Apple Developer, $99 в год | Google Play Console, $25 один раз |
| Время проверки | 1-3 дня | несколько часов - 3 дня |

## Шаги (один раз)

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/ios @capacitor/android @capacitor/push-notifications @capacitor/geolocation @capacitor/camera
npx cap add ios
npx cap add android
npx cap sync
```

- iPhone: `npx cap open ios` → в Xcode выбрать Team, поставить иконку (`public/icon-512.png`), Product → Archive → Distribute App.
- Android: `npx cap open android` → Build → Generate Signed Bundle (.aab) → загрузить в Play Console.

## Важно для проверки Apple

Apple отклоняет приложения, которые являются «просто сайтом». Чтобы пройти проверку:
1. Подключите нативные push-уведомления (`@capacitor/push-notifications`, APNs-ключ в Apple Developer).
2. Камера и геолокация через плагины Capacitor (`@capacitor/camera`, `@capacitor/geolocation`), в `Info.plist` описать, зачем они нужны:
   - `NSCameraUsageDescription`: «Чтобы сфотографировать мешки у двери».
   - `NSLocationWhenInUseUsageDescription`: «Чтобы найти ваш адрес и показать исполнителя на карте».
3. Политика конфиденциальности и вход по SMS (или Sign in with Apple, если есть вход через соцсети).
4. Возможно, отдельные приложения для клиента и исполнителя (два `appId`), так проще пройти модерацию.
