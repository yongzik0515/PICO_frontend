# 도우미 미리 해 보기 (온보딩 웹앱)

`사전신청/design/project`의 캔버스 2차 시안 보드 10개를 그대로 웹앱으로 띄워요. 서버 없이 가짜 데이터만 써요.

## 실행

```bash
cd onboarding
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 생성
```

## 시안이 바뀌었을 때

캔버스 보드(`사전신청/design/project/*.dc.html`)가 원본이에요. 보드를 고친 뒤 아래를 실행하면 `src/boards/*.js`가 다시 만들어져요. `src/boards`는 직접 고치지 마세요.

```bash
npm run sync
```

## 주소

| 주소 | 보드 |
|---|---|
| `/` | 처음 화면(이용자·도우미 고르기) |
| `/user` `/user/profile` `/user/quote` `/user/request` `/user/done` | 이용자 함께 해 보기 |
| `/user/practice` | 이용자 혼자 해 보기 |
| `/helper` | 1 메인(도우미) |
| `/my` `/leads` `/detail` `/terms` `/matched` | 2-1 ~ 2-5 함께 해 보기 |
| `/cases` | 2-6 이런 경우도 있어요 |
| `/practice` | 3 혼자 해 보기 |

보드와 주소 목록은 `src/routes.js`에 있어요. 보드 안 링크(`M3-my.dc.html` 등)는 이 주소로 바뀌어요.

## 처음 화면과 뒤로 가기

- `/`는 이용자·도우미를 고르는 처음 화면이에요. 이용자 가이드는 `/user`부터, 도우미 가이드는 `/helper`부터 시작해요.
- 처음 화면을 뺀 모든 화면 왼쪽 위에 뒤로 가기 버튼이 있어요(`src/App.tsx`). 이전 화면으로 돌아가고, 주소로 바로 들어와 이전 화면이 없으면 처음 화면으로 가요. 화면 안의 단계는 처음부터 다시 시작해요.

## 시안과 다른 점

- 각 마침 화면의 '회원가입하기'는 https://pico-kr.app/login 으로 가요. 사전 신청 화면(시안 4번 `M11-apply`)은 웹앱에서 뺐어요.
- 휴대폰에서는 화면을 꽉 채우고, 폭 600px 이상(PC·태블릿)에서는 휴대폰 틀을 가운데에 띄워요.

## Vercel 연결

1. Vercel → Add New → Project → GitHub 저장소 `PICO_frontend` 가져오기
2. **Root Directory**를 `onboarding`으로 지정 (Framework는 Vite로 자동 인식, 빌드 `npm run build`, 출력 `dist`)
3. Deploy
4. Settings → Git → Production Branch를 배포할 브랜치로 지정. 다른 브랜치에 올리면 미리보기 주소가 따로 생겨요.
5. 도메인: Settings → Domains에서 하위 도메인(예: `onboarding.pico-kr.app`)을 추가하고, 안내대로 DNS에 CNAME을 등록해요.

`vercel.json`이 모든 주소를 `index.html`로 보내서 `/detail` 같은 주소로 바로 들어와도 열려요.
