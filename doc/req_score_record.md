# 점수 서버에 기록

## 요구사항
- 게임 플레이 도중 점수를 기록한다.
- 각 스테이지가 끝나면 서버에서 각 스테이지의 top10 기록을 가져와서 보여준다.
- 방금 기록이 top10 안에 있으면, top10에 추가한다.
- 그렇지 않으면, top10을 유지한다.
- top10의 기록은 서버에 저장이 된다.

## 게임 점수 계산
- 공격이 적중할 때마다 점수가 100점 증가한다.
- 특수공격이 적중할 때마다 점수가 200점 증가한다.

- 보스가 공격 적중할 때마다 위 점수에 추가점수 50씩 더해진다.


- 보스를 죽이면 3000점의 보너스 점수가 있다. 보스 전투에서 소요된 시간에서 각 30초마다 보너스 점수 100점씩 차감된다.
- 보스의 보너스 점수는 화면 좌측 상단에 표시된다.

## 점수 서버에 관리
- 각 스테이지별 top10 점수가 서버에 저장된다.
- top10의 기록은 서버에 저장이 된다.


## 시나리오
- 각 스테이지를 시작할 때 점수는 0점부터 시작한다.
- 게임 플레이 도중 점수가 계산되며 화면 우측 상단에 표시된다.
- 플레이어가 죽거나 보스를 죽여서 스테이지가 끝나서 게임 종료 화면으로 넘어가면, 서버에서 각 스테이지의 top10 기록을 가져와서 게임 종료 화면 위에 보여준다.
- top10 리스트는 '순위, 날짜, 닉네임, 점수, 메시지'로 구성된다.
- 순위는 1부터 시작한다.

- 방금 점수가 top10 안에 있으면, top10에 기록 추가창을 보여준다.
- 기록 추가창은 닉네임, 메시지를 입력할 수 있는 창으로 구성된다.
- 입력이 완료되면 top10을 업데이트하고 서버에 저장한다.

- 방금 점수가 top10에 들어가지 않으면 기록 추가창 표시 없이 top10을 보여주고 끝난다.

- top10 표시 화면에서 확인 버튼을 누르면 게임 종료 화면으로 이동한다.



## 서버 정보
- firebase firestore 사용한다.
- 아래는 서버 정보이다.
    - collection: 'the-fallen-scores'
    - document: 'ranking1'    # 스테이지 1의 top10
    - document: 'ranking2'    # 스테이지 2의 top10
    - field: 'datetime', type: 'timestamp'
    - field: 'nickname', type: 'string'
    - field: 'score', type: 'int64'
    - field: 'message', type: 'string'


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDm9xVrjXO9zv2UdKedfbSj9Dg7H52JGGg",
  authDomain: "smilepark-game.firebaseapp.com",
  projectId: "smilepark-game",
  storageBucket: "smilepark-game.firebasestorage.app",
  messagingSenderId: "318047344293",
  appId: "1:318047344293:web:0e055f90254b8ccf211f4c",
  measurementId: "G-DB0FC53WVC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
