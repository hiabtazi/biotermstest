import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // هذا الإعداد يضمن أن المسارات تعمل بشكل صحيح عند فتح الملفات مباشرة من مجلد dist
  base: './',

  build: {
    // اسم مجلد المخرجات (النتيجة النهائية)
    outDir: 'dist',

    rollupOptions: {
      // هنا نحدد كل صفحات الـ HTML كنقاط دخول (Entry Points) للمشروع
      input: {
        main: resolve(__dirname, 'index.html'),
        addConcept: resolve(__dirname, 'src/add-concept.html'),
        app: resolve(__dirname, 'src/app.html'),
        bookmarks: resolve(__dirname, 'src/bookmarks.html'),
        dashboard: resolve(__dirname, 'src/dashboard.html'),
        guide: resolve(__dirname, 'src/guide.html'),
        login: resolve(__dirname, 'src/login.html'),
        notifications: resolve(__dirname, 'src/notifications.html'),
        reset: resolve(__dirname, 'src/reset.html'),
        signup: resolve(__dirname, 'src/signup.html'),
        userInfo: resolve(__dirname, 'src/user-info.html'),
        verify: resolve(__dirname, 'src/verify.html'),
        forgotPassword: resolve(__dirname, 'src/forgot-password.html'), 
      },
    },
  },
  
  // هذا الإعداد مفيد جداً لتسهيل استدعاء الملفات من داخل مجلد src
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});