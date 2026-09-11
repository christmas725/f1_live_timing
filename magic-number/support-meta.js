export const SERIES_META = {
  f2: {
    title: 'F2', full: 'FIA Formula 2', color: 'ff365e', normalDriverMax: 39, normalTeamMax: 65,
    guide: [
      ['SR', '스프린트 레이스'], ['FR', '피처 레이스'], ['폴', '피처 레이스 폴포지션 2점'], ['FL', '각 레이스 패스티스트랩 1점']
    ],
    method: '일반 라운드에서 드라이버 최대 39점, 팀 최대 65점을 기준으로 계산합니다.'
  },
  f3: {
    title: 'F3', full: 'FIA Formula 3', color: '6ea8ff', normalDriverMax: 39, normalTeamMax: 89,
    guide: [
      ['SR', '스프린트 레이스'], ['FR', '피처 레이스'], ['폴', '피처 레이스 폴포지션 2점'], ['마드리드', '2026 최종전은 피처 레이스가 2회']
    ],
    method: '일반 라운드는 드라이버 39점·팀 89점, 2026 마드리드 최종전은 추가 피처 레이스와 폴을 반영해 67점·150점으로 계산합니다.'
  },
  f1a: {
    title: 'F1 Academy', full: 'F1 Academy', color: '9b5cff', normalDriverMax: 39, normalTeamMax: 86,
    guide: [
      ['RG', '리버스 그리드 레이스'], ['FR', '피처 레이스'], ['OR', '몬트리올·오스틴 오프닝 레이스'], ['폴/FL', '폴 2점 + 각 레이스 패스티스트랩 1점']
    ],
    method: '일반 라운드는 드라이버 39점·팀 86점, 오프닝 레이스가 있는 오스틴은 65점·145점으로 계산합니다.'
  }
};

export const DRIVER_META = {
  f2: {
    'N. Tsolov':['니콜라 촐로프','Campos Racing','TSO'], 'R. Câmara':['하파엘 카마라','Invicta Racing','CAM'],
    'G. Mini':['가브리엘레 미니','MP Motorsport','MIN'], 'A. Dunne':['알렉스 던','Rodin Motorsport','DUN'],
    'N. Leon':['노엘 레온','Campos Racing','LEO'], 'K. Maini':['쿠시 마이니','ART Grand Prix','MAI'],
    'D. Beganovic':['디노 베가노비치','DAMS Lucas Oil','BEG'], 'J. Dürksen':['조슈아 뒤르크센','Invicta Racing','DUR'],
    'L. van Hoepen':['로렌스 판 후펜','TRIDENT','VHO'], 'T. Inthraphuvasak':['타사나폴 인트라푸바사크','ART Grand Prix','INT'],
    'M. Stenshorne':['마르티니우스 스텐스호른','Rodin Motorsport','STE'], 'R. Miyata':['리토모 미야타','Hitech','MIY'],
    'J. Bennett':['존 베넷','TRIDENT','BEN'], 'R. Villagomez':['라파엘 비야고메스','Van Amersfoort Racing','VIL'],
    'O. Goethe':['올리버 괴테','MP Motorsport','GOE'], 'S. Montoya':['세바스티안 몬토야','PREMA Racing','MON'],
    'C. Herta':['콜튼 허타','Hitech','HER'], 'R. Bilinski':['로만 빌린스키','DAMS Lucas Oil','BIL'],
    'N. Varrone':['니코 바론','Van Amersfoort Racing','VAR'], 'M. Boya':['마리 보야','PREMA Racing','BOY'],
    'E. Fittipaldi':['에메르손 피티팔디','AIX Racing','FIT'], 'C. Shields':['시안 실즈','AIX Racing','SHI']
  },
  f3: {
    'F. Slater':['프레디 슬레이터','TRIDENT','SLA'], 'U. Ugochukwu':['우고 우고추쿠','Campos Racing','UGO'],
    'E. Rivera':['에르네스토 리베라','Campos Racing','RIV'], 'T. Naël':['테오필 나엘','Campos Racing','NAE'],
    'B. Badoer':['브란도 바도에르','Rodin Motorsport','BAD'], 'T. Kato':['타이토 카토','ART Grand Prix','KAT'],
    'H. Yamakoshi':['히유 야마코시','Van Amersfoort Racing','YAM'], 'N. Stromsted':['노아 스트룀스테드','TRIDENT','STR'],
    'T. Taponen':['투카 타포넨','MP Motorsport','TAP'], 'M. Gladysz':['마치에이 글라디시','ART Grand Prix','GLA'],
    'B. Del Pino':['브루노 델 피노','Van Amersfoort Racing','DPI'], 'P. Clerot':['페드로 클레로','Rodin Motorsport','CLE'],
    'J. Nakamura':['진 나카무라','Hitech','NAK'], 'M. Colnaghi':['마티아 콜나기','MP Motorsport','COL'],
    'J. Wharton':['제임스 워튼','PREMA Racing','WHA'], 'E. Deligny':['엔초 들리니','Van Amersfoort Racing','DEL'],
    'L. Sharp':['루이스 샤프','PREMA Racing','SHA'], 'G. Xie':['제라드 셰','DAMS Lucas Oil','XIE'],
    'K. Le':['카나토 르','ART Grand Prix','LE'], 'A. Giusti':['알레산드로 주스티','MP Motorsport','GIU'],
    'Y. David':['예반 데이비드','AIX Racing','DAV'], 'M. De Palo':['마테오 데 팔로','TRIDENT','DEP'],
    'N. Lacorte':['니콜라 라코르테','DAMS Lucas Oil','LAC'], 'B. Benavides':['브래드 베나비데스','AIX Racing','BEN'],
    'C. Ho':['크리스티안 호','Rodin Motorsport','HO'], 'F. Mclaughlin':['피온 맥러플린','Hitech','MCL'],
    'F. Barrichello':['페르난도 바리첼로','AIX Racing','BAR'],
    'J. Garfias':['호세 가르피아스','PREMA Racing','GAR'], 'N. Bhirombhakdi':['난다부드 비롬박디','DAMS Lucas Oil','BHI'],
    'P. Heuzenroeder':['패트릭 호이젠뢰더','Campos Racing','HEU'], 'W. Shin':['신우현','Hitech','SHI'],
    'M. Shin':['신우현','Hitech','SHI'], 'S. Hanna':['살림 한나','AIX Racing','HAN'],
    'R. Escotto':['리카르도 에스코토','AIX Racing','ESC'], 'N. Maccagnani':['니콜로 마카냐니','Rodin Motorsport','MAC'],
    'A. Powell':['알렉스 파월','PREMA Racing','POW']
  },
  f1a: {
    'A. Palmowski':['알리샤 팔모프스키','Campos Racing','PAL'], 'E. Felbermayr':['엠마 펠버마이어','Rodin Motorsport','FEL'],
    'N. Gademan':['니나 가데만','MP Motorsport','GAD'], 'A. Larsen':['알바 라르센','MP Motorsport','LAR'],
    'P. Westcott':['페이튼 웨스트콧','PREMA Racing','WES'], 'M. Bruce':['메건 브루스','Campos Racing','BRU'],
    'E. Lloyd':['엘라 로이드','Rodin Motorsport','LLO'], 'M. Paatz':['마틸다 파츠','PREMA Racing','PAA'],
    'N. Granada':['나탈리아 그라나다','PREMA Racing','GRA'], 'R. Ferreira':['하파엘라 페레이라','Campos Racing','FER'],
    'R. Robertson':['레이첼 로버트슨','Hitech','ROB'], 'L. Billard':['리사 빌라르','ART Grand Prix','BIL'],
    'K. Countryman':['케일리 컨트리맨','ART Grand Prix','COU'], 'A. Dobson':['에이바 돕슨','Hitech','DOB'],
    'E. Kosterman':['에스메 코스터만','MP Motorsport','KOS'], 'E. Stevens':['엘라 스티븐스','Rodin Motorsport','STE'],
    'J. Jacquet':['제이드 자케','ART Grand Prix','JAC'], 'Z. Florescu':['조이 플로레스쿠','Hitech','FLO'],
    'C. Bättig':['키아라 베티그','Hitech','BAE'], 'A. Fisher':['오텀 피셔','Hitech','FIS'], 'W. Shi':['시 웨이','Hitech','SHI'],
    'C. Bättig (WCD)BAE':['키아라 베티그','Hitech','BAE'], 'C. Bättig (WCD)':['키아라 베티그','Hitech','BAE'],
    'A. Fisher (WCD)FIS':['오텀 피셔','Hitech','FIS'], 'A. Fisher (WCD)':['오텀 피셔','Hitech','FIS'],
    'W. Shi (WCD)SHI':['시 웨이','Hitech','SHI'], 'W. Shi (WCD)':['시 웨이','Hitech','SHI'],
    'Z. Florescu (WCD)FLO':['조이 플로레스쿠','Hitech','FLO'], 'Z. Florescu (WCD)':['조이 플로레스쿠','Hitech','FLO'],
    'Chiara Bättig (WCD)':['키아라 베티그','Hitech','BAE'], 'Autumn Fisher (WCD)':['오텀 피셔','Hitech','FIS'],
    'Shi Wei (WCD)':['시 웨이','Hitech','SHI'], 'Wei Shi (WCD)':['시 웨이','Hitech','SHI'], 'Zoe Florescu (WCD)':['조이 플로레스쿠','Hitech','FLO']
  }
};

export const TEAM_KO = {
  'Campos Racing':'캄포스 레이싱', 'Invicta Racing':'인빅타 레이싱', 'MP Motorsport':'MP 모터스포트',
  'Rodin Motorsport':'로댕 모터스포트', 'ART Grand Prix':'ART 그랑프리', 'DAMS Lucas Oil':'DAMS 루카스 오일',
  'TRIDENT':'트라이던트', 'Hitech':'하이테크', 'Hitech TGR':'하이테크', 'Van Amersfoort Racing':'반 아메르스포르트 레이싱',
  'PREMA Racing':'프레마 레이싱', 'AIX Racing':'AIX 레이싱'
};

export const TEAM_COLORS = {
  'Campos Racing':'4e8cff','Invicta Racing':'22c55e','MP Motorsport':'ff8a00','Rodin Motorsport':'7b61ff',
  'ART Grand Prix':'ff365e','DAMS Lucas Oil':'2d8cff','TRIDENT':'6e7688','Hitech':'9cdb43','Hitech TGR':'9cdb43',
  'Van Amersfoort Racing':'f2c94c','PREMA Racing':'e8002d','AIX Racing':'c27aff'
};
