# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.


Android (nativo) — pasos rápidos
--------------------------------

1. Eject / prebuild a bare workflow

    - Recomendado (Expo):

       ```bash
       npx expo prebuild
       ```

    - (Alternativa legacy) eject:

       ```bash
       expo eject
       ```

2. Instalar la librería nativa TFLite

    - Ejemplo usando `tflite-react-native`:

       ```bash
       # yarn
       yarn add tflite-react-native

       # o npm
       npm install tflite-react-native
       ```

    - Después de instalar en iOS ejecutar:

       ```bash
       npx pod-install ios
       ```

3. Copiar el archivo `.tflite` a los assets de Android

    - En Windows (PowerShell):

       ```powershell
       md android\app\src\main\assets -Force
       copy .\assets\models\morchella_classifier_small.tflite android\app\src\main\assets\
       ```

    - En macOS / Linux:

       ```bash
       mkdir -p android/app/src/main/assets
       cp ./assets/models/morchella_classifier_small.tflite android/app/src/main/assets/
       ```

4. Reconstruir la app y ejecutar en Android

    - Con prebuild/Expo:

       ```bash
       npx expo run:android
       ```

    - O con React Native CLI:

       ```bash
       npx react-native run-android
       ```

5. Notas importantes

- `services/morchellaModel.ts` ahora detecta plataforma y usa el binding nativo (`tflite-react-native` o `react-native-tflite`) en Android/iOS.
- Asegúrate de instalar y linkear la librería nativa antes de reconstruir la app.
- En Android la ruta del modelo es `android/app/src/main/assets/morchella_classifier_small.tflite`.
- Si usas Expo Go (managed) no funcionará la parte nativa; debes usar el bare workflow o una build personalizada.

Si quieres, puedo: ejectar el proyecto por ti (ejecutando `npx expo prebuild`), añadir un script para copiar automáticamente el .tflite a `android/app/src/main/assets`, y dejar pasos listos para compilar. ¿Lo hago? 
