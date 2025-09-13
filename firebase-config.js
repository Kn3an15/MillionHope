// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAMZLJ1yS2Yhkh-F1bFNvS3pocfT3z4y5M",
  authDomain: "million-hope.firebaseapp.com",
  projectId: "million-hope",
  storageBucket: "million-hope.firebasestorage.app",
  messagingSenderId: "1072620052968",
  appId: "1:1072620052968:web:48ce62654277d8c0d6445d",
  measurementId: "G-FTYZH36C2P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
