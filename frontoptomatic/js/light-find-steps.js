/* ============================================================================
 * light-find-steps.js — Office 알고리즘(PDF)의 "조명 타입 선택 이후" 세부 스텝 정의.
 *
 * window.LF_STEPS(project, space, lighting) → 카드 스텝 factory 배열을 반환.
 *   · 각 factory(selections) → 스텝객체 { key, title, cards:[{title, sub?, img?}] } 또는
 *     null(조건 미충족 → 건너뜀). selections 는 {스텝제목: 선택라벨}.
 *   · 가격(Fixture Price) 스텝은 light-find-config.js 가 항상 마지막에 자동으로 붙인다.
 *
 * 분기 케이스:
 *   · 천장고(CH) 밴드는 천장타입(CT) 선택에 따라 다름(Closed vs Exposed).
 *   · Corridor 의 Suspended linear: Closed 면 High 만, Exposed 면 Standard/High.
 *   · Workspace_General light: CT→CH→Lighting type→(Layout) 으로, 조명타입이 위저드
 *     안에서 선택되고 DN/UP·DN 일 때만 Layout 단계가 뜬다.
 *
 * 이미지: src/main/resources/static/assets/light_find/Office/ 아래 PNG.
 * ========================================================================== */
(function () {
  "use strict";
  var IMG = "https://optomatic-light-find.vercel.app/Office/";

  // Workspace 조명타입 행(Figma node 6:603) 아이콘 — currentColor 인라인(선택 시 흰색 반전).
  function svg(d, flip) {
    return '<svg class="lf-option__icon' + (flip ? ' lf-option__icon--flip' : '') +
      '" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><path d="' + d + '" fill="currentColor" /></svg>';
  }
  var LTICON = {
    flat: svg("M8.44042 27.5C7.72236 27.5 7.10833 27.245 6.59833 26.735C6.08833 26.225 5.83333 25.611 5.83333 24.8929V15.1071C5.83333 14.389 6.08833 13.775 6.59833 13.265C7.10833 12.755 7.72236 12.5 8.44042 12.5H31.5596C32.2776 12.5 32.8917 12.755 33.4017 13.265C33.9117 13.775 34.1667 14.389 34.1667 15.1071V24.8929C34.1667 25.611 33.9117 26.225 33.4017 26.735C32.8917 27.245 32.2776 27.5 31.5596 27.5H8.44042Z"),
    surface: svg("M9.11333 32.5V30.4058H11.6058L14.9242 19.3579C15.0844 18.7937 15.3925 18.3413 15.8483 18.0004C16.3042 17.6596 16.8233 17.4892 17.4058 17.4892H22.5942C23.1767 17.4892 23.6958 17.6596 24.1517 18.0004C24.6075 18.3413 24.9156 18.7937 25.0758 19.3579L28.3942 30.4058H30.8867V32.5H9.11333ZM18.9529 12.8313V5.73708H21.0471V12.8313H18.9529ZM28.3908 16.7629L26.8913 15.2629L31.9325 10.2629L33.3908 11.7212L28.3908 16.7629ZM30.8225 24.7008V22.6071H37.9167V24.7008H30.8225ZM11.6092 16.7629L6.60917 11.7212L8.0675 10.2629L13.1087 15.2629L11.6092 16.7629ZM2.08333 24.7008V22.6071H9.1775V24.7008H2.08333Z", true),
    suspended: svg("M9.49375 23.9208V16.1025H30.5063V23.9208H9.49375ZM18.9979 8.00208V3.71792H21.0917V8.00208H18.9979ZM30.8633 12.4017L29.3996 10.9379L32.0533 8.27375L33.5279 9.74792L30.8633 12.4017ZM18.9979 36.2179V31.9338H21.0917V36.2179H18.9979ZM32.0533 31.6879L29.3996 29.0233L30.8633 27.5492L33.5279 30.2137L32.0533 31.6879ZM9.13667 12.4017L6.47208 9.74792L7.94667 8.27375L10.6112 10.9379L9.13667 12.4017ZM7.94667 31.6879L6.47208 30.2137L9.13667 27.5492L10.6112 29.0233L7.94667 31.6879Z"),
    track: svg("M12.6508 32.5C11.2147 32.5 9.99722 31.9894 8.99833 30.9683C7.99944 29.9472 7.5 28.7132 7.5 27.2663C7.5 25.8196 7.99944 24.5851 8.99833 23.5629C9.99722 22.541 11.2147 22.03 12.6508 22.03H30.6825C32.1186 22.03 33.3361 22.5406 34.335 23.5617C35.3339 24.5828 35.8333 25.8167 35.8333 27.2663C35.8333 28.7103 35.3339 29.9447 34.335 30.9667C33.3361 31.9889 32.1186 32.5 30.6825 32.5H12.6508ZM9.3175 17.97C7.88139 17.97 6.66389 17.4594 5.665 16.4383C4.66611 15.4172 4.16667 14.1833 4.16667 12.7367C4.16667 11.2897 4.66611 10.0553 5.665 9.03333C6.66389 8.01111 7.88139 7.5 9.3175 7.5H27.3492C28.7853 7.5 30.0028 8.01056 31.0017 9.03167C32.0006 10.0528 32.5 11.2868 32.5 12.7337C32.5 14.1804 32.0006 15.4149 31.0017 16.4371C30.0028 17.459 28.7853 17.97 27.3492 17.97H9.3175Z")
  };
  function lt(label, icon) { return { title: label, icon: icon, info: true }; }
  // PDF p.10/Figma: Closed. p.12: Exposed/Standard. p.13: Exposed/High(+Suspended downlight).
  var WS_LT_CLOSED = [
    lt("Flat panel light 600 x 600", LTICON.flat), lt("Flat panel light 300 x 1200", LTICON.flat),
    lt("Surface mounted linear light", LTICON.surface), lt("Suspended linear light (UP/DN)", LTICON.suspended),
    lt("Suspended linear light (DN)", LTICON.suspended), lt("Track system", LTICON.track)
  ];
  // Closed + High(천장고 3000<CH≤3300): Flat panel 제외, Suspended (UP) 추가 (사용자 요청).
  var WS_LT_CLOSED_HIGH = [
    lt("Surface mounted linear light", LTICON.surface), lt("Suspended linear light (DN)", LTICON.suspended),
    lt("Suspended linear light (UP/DN)", LTICON.suspended), lt("Suspended linear light (UP)", LTICON.suspended),
    lt("Track system", LTICON.track)
  ];
  var WS_LT_EXPOSED_STD = [
    lt("Suspended linear light (DN)", LTICON.suspended), lt("Suspended linear light (UP/DN)", LTICON.suspended),
    lt("Track system", LTICON.track)
  ];
  var WS_LT_EXPOSED_HIGH = [
    lt("Suspended linear light (UP/DN)", LTICON.suspended), lt("Suspended linear light (DN)", LTICON.suspended),
    lt("Track system", LTICON.track), lt("Suspended downlight", LTICON.suspended)
  ];

  // ── 카드 묶음 ──────────────────────────────────────────────────────────
  var CARD = {
    ceilingType: [
      { title: "Closed Ceiling", img: IMG + "Office_CeilingType/Office_CeilingType_Closed.png" },
      { title: "Exposed Ceiling", img: IMG + "Office_CeilingType/Office_CeilingType_Exposed.png" }
    ],
    chClosed: [
      { title: "Standard", sub: "2600 ≤ CH ≤ 3000 mm", img: IMG + "Office_CeilingHeight_Closed/Office_CeilingHeight_Closed_CH.2600-3000.png" },
      { title: "High", sub: "3000 < CH ≤ 3300 mm", img: IMG + "Office_CeilingHeight_Closed/Office_CeilingHeight_Closed_CH.3000-3300.png" }
    ],
    chExposed: [
      { title: "Standard", sub: "CH ≤ 3300 mm", img: IMG + "Office_CeilingHeight_Exposed/Office_CeilingHeight_Exposed_CH.3300이하.png" },
      { title: "High", sub: "CH > 3300 mm", img: IMG + "Office_CeilingHeight_Exposed/Office_CeilingHeight_Exposed_CH.3300초과.png" }
    ],
    chHighOnly: [
      { title: "High", sub: "3000 < CH ≤ 3300 mm", img: IMG + "Office_CeilingHeight_Closed/Office_CeilingHeight_Closed_CH.3000-3300.png" }
    ],
    layout: [
      { title: "Single layout", img: IMG + "Office_LightingLayout/Office_LightingLayout_Single.png" },
      { title: "Double layout", img: IMG + "Office_LightingLayout/Office_LightingLayout_Double.png" }
    ],
    openingSize: [
      { title: "150 ≤ D < 200 mm", img: IMG + "Office_WallIndirectLinearLtg_OpeningSize/Office_WallIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm", img: IMG + "Office_WallIndirectLinearLtg_OpeningSize/Office_WallIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    wsLayoutClosed: [
      { title: "Desk Center", img: IMG + "Office_Workspace_GeneralLtg_Closed_Layout/Office_Workspace_GeneralLtg_Closed_Layout_Desk.png" },
      { title: "Space", img: IMG + "Office_Workspace_GeneralLtg_Closed_Layout/Office_Workspace_GeneralLtg_Closed_Layout_Space.png" }
    ],
    wsLayoutExposed: [
      { title: "Desk Center", img: IMG + "Office_Workspace_GeneralLtg_Exposed_Layout/Office_Workspace_GeneralLtg_Exposed_Layout_Desk.png" },
      { title: "Space", img: IMG + "Office_Workspace_GeneralLtg_Exposed_Layout/Office_Workspace_GeneralLtg_Exposed_Layout_Space.png" }
    ]
  };

  function isExposed(sel) { return sel["Ceiling Type"] === "Exposed Ceiling"; }

  // ── 스텝 factory ──────────────────────────────────────────────────────
  function ceilingType() { return { key: "ct", title: "Ceiling Type", cards: CARD.ceilingType }; }
  function ceilingHeight(sel) {
    return { key: "ch", title: "Ceiling Height", cards: isExposed(sel) ? CARD.chExposed : CARD.chClosed };
  }
  // Corridor Suspended: Closed→High만, Exposed→Standard/High
  function ceilingHeightSuspended(sel) {
    return { key: "ch", title: "Ceiling Height", cards: isExposed(sel) ? CARD.chExposed : CARD.chHighOnly };
  }
  function lightingLayout() { return { key: "lay", title: "Lighting Layout", cards: CARD.layout }; }
  function openingSize() { return { key: "os", title: "Opening Size", cards: CARD.openingSize }; }
  // Workspace_General 전용: 조명타입 목록은 천장타입 + 천장고에 따라 달라진다(PDF).
  // variant:"list" → config 가 카드 대신 행(아이콘+라벨+ⓘ, Figma node 6:603)으로 렌더.
  function wsLightingType(sel) {
    var high = sel["Ceiling Height"] === "High";
    var cards;
    if (isExposed(sel)) cards = high ? WS_LT_EXPOSED_HIGH : WS_LT_EXPOSED_STD;
    else cards = high ? WS_LT_CLOSED_HIGH : WS_LT_CLOSED;
    return { key: "lt", title: "Lighting type", variant: "list", cards: cards };
  }
  function wsLayout(sel) {
    // Exposed + High: Layout 단계 없이 바로 Fixture Price (총 4단계, 사용자 요청).
    if (isExposed(sel) && sel["Ceiling Height"] === "High") return null;
    var lt = sel["Lighting type"];
    if (lt === "Suspended linear light (DN)" || lt === "Suspended linear light (UP/DN)") {
      return { key: "lay", title: "Layout criteria", cards: isExposed(sel) ? CARD.wsLayoutExposed : CARD.wsLayoutClosed };
    }
    return null; // 그 외 조명타입은 Layout 단계 없이 가격으로 직행
  }

  // 자주 쓰는 시퀀스
  var CH = [ceilingHeight];
  var CH_LAY = [ceilingHeight, lightingLayout];
  var CT_CH = [ceilingType, ceilingHeight];
  var OS = [openingSize];
  var PRICE_ONLY = [];
  var WORKSPACE_GENERAL = [ceilingType, ceilingHeight, wsLightingType, wsLayout];

  // ======================= RESIDENTIAL =======================
  // PDF: 260520_Optomatic_Algorithm_Residential. Office 와 달리 천장 타입(Closed/Exposed)
  // 분기가 없고, 천장고는 단일 밴드(2300~2600 / 2600~3000)만 쓴다. "비활성화" 는 조명
  // 타입이 아닌 하위 카드 옵션 차원(Night light→Trimless, Wall mtd @Mirror→Round,
  // Corridor Wall mounted→General lighting) → 해당 카드에 disabled:true (UI 에서 끌 수
  // 있게 스텝은 그대로 동작).  이미지 폴더 일부는 철자/특수문자 그대로 사용해야 함
  // (예: 'Residentail_DiningRoom_TableSize', '@Closet', '&Oval', 공백/한글 '이상').
  var RIMG = "https://optomatic-light-find.vercel.app/Residential/";
  var RCARD = {
    ch: [
      { title: "Standard", sub: "2300 ≤ CH ≤ 2600 mm", img: RIMG + "Residential_CeilingHeight/Residential_CeilingHeight_CH2300-2600.png" },
      { title: "High", sub: "2600 < CH ≤ 3000 mm", img: RIMG + "Residential_CeilingHeight/Residential_CeilingHeight_CH2600-3000.png" }
    ],
    layout: [
      { title: "Single layout", img: RIMG + "Residential_LightingLayout/Residential_LightingLayout_Single.png" },
      { title: "Double layout", img: RIMG + "Residential_LightingLayout/Residential_LightingLayout_Double.png" }
    ],
    frame: [
      { title: "Trim", img: RIMG + "Residential_RecessedDL_FrameType/Residential_RecessedDL_FrameType_Trim.png" },
      { title: "Trimless", img: RIMG + "Residential_RecessedDL_FrameType/Residential_RecessedDL_FrameType_Trimless.png" }
    ],
    // Night light: Trimless 비활성화(추후 켤 수 있게 카드는 유지).
    frameNight: [
      { title: "Trim", img: RIMG + "Residential_NightLtg_FrameType/Residential_NightLtg_Trim.jpg" },
      { title: "Trimless", img: RIMG + "Residential_NightLtg_FrameType/Residential_NightLtg_Trimless.jpg", disabled: true }
    ],
    osWall: [
      { title: "150 ≤ D < 200 mm", img: RIMG + "Residential_WallIndirectLinearLtg_OpeningSize/Residential_WallIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm", img: RIMG + "Residential_WallIndirectLinearLtg_OpeningSize/Residential_WallIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    osCeiling: [
      { title: "150 ≤ D < 200 mm", img: RIMG + "Residential_CeilingIndirectLinearLtg_OpeningSize/Residential_CeilingIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm", img: RIMG + "Residential_CeilingIndirectLinearLtg_OpeningSize/Residential_CeilingIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    lightBox: [
      { title: "Linear", img: RIMG + "Residential_CeilingIndirectLinearLtg_LtgboxType/Residential_CeilingIndirectLinearLtg_LtgboxType_Linear.png" },
      { title: "Curved", img: RIMG + "Residential_CeilingIndirectLinearLtg_LtgboxType/Residential_CeilingIndirectLinearLtg_LtgboxType_Curved.png" }
    ],
    purpose: [
      { title: "Atmospheric lighting", img: RIMG + "Residential_WallMtdLtg_Purpose/Residential_WallMtdLtg_Purpose_Atmospheric lighting.png" },
      { title: "General lighting", img: RIMG + "Residential_WallMtdLtg_Purpose/Residential_WallMtdLtg_Purpose_General lighting.png" }
    ],
    // Corridor Wall mounted light: General lighting(조도용) 비활성화.
    purposeCorridor: [
      { title: "Atmospheric lighting", img: RIMG + "Residential_WallMtdLtg_Purpose/Residential_WallMtdLtg_Purpose_Atmospheric lighting.png" },
      { title: "General lighting", img: RIMG + "Residential_WallMtdLtg_Purpose/Residential_WallMtdLtg_Purpose_General lighting.png", disabled: true }
    ],
    furniture: [
      { title: "Standard", img: RIMG + "Residential_LivingRoom_FurnitureType/Residential_LivingRoom_FurnitureType_Standard.jpg" },
      { title: "Optional", img: RIMG + "Residential_LivingRoom_FurnitureType/Residential_LivingRoom_FurnitureType_Optional.png" }
    ],
    // Wall mounted light @Mirror: Round 비활성화.
    mirror: [
      { title: "Round", img: RIMG + "Residential_WallMtdLtg@Mirror_MirrorShape/Residential_WallMtdLtg@Mirror_MirrorShape_Round.png", disabled: true },
      { title: "Rectangular & Oval", img: RIMG + "Residential_WallMtdLtg@Mirror_MirrorShape/Residential_WallMtdLtg@Mirror_MirrorShape_Rectangular&Oval.png" }
    ],
    install: [
      { title: "Under Shelving", img: RIMG + "Residential_ShelvingLtg_InstallLocation/Residential_ShelvingLtg_InstallLocation_UnderShelving.png" },
      { title: "On Shelving", img: RIMG + "Residential_ShelvingLtg_InstallLocation/Residential_ShelvingLtg_InstallLocation_OnShelving.png" }
    ],
    closetLayout: [
      { title: "1row", img: RIMG + "Residential_IntegratedLinearLtg@Closet/Residential_IntegratedLinearLtg@Closet_1row.jpg" },
      { title: "2rows", img: RIMG + "Residential_IntegratedLinearLtg@Closet/Residential_IntegratedLinearLtg@Closet_2rows.jpg" }
    ],
    tableSize: [
      { title: "Up to 4 people", sub: "L ≤ 1600 mm", img: RIMG + "Residentail_DiningRoom_TableSize/Residential_DiningRoom_TableSize_4orLess.png" },
      { title: "For 6+ people", sub: "L > 1600 mm", img: RIMG + "Residentail_DiningRoom_TableSize/Residential_DiningRoom_TableSize_6orMore.png" }
    ]
  };

  function rCH() { return { key: "ch", title: "Ceiling Height", cards: RCARD.ch }; }
  function rLayout() { return { key: "lay", title: "Lighting Layout", cards: RCARD.layout }; }
  function rFrame() { return { key: "ft", title: "Frame Type", cards: RCARD.frame }; }
  function rFrameNight() { return { key: "ft", title: "Frame Type", cards: RCARD.frameNight }; }
  function rOSWall() { return { key: "os", title: "Opening Size", cards: RCARD.osWall }; }
  function rOSCeiling() { return { key: "os", title: "Opening Size", cards: RCARD.osCeiling }; }
  function rLightBox() { return { key: "lbt", title: "Light box Type", cards: RCARD.lightBox }; }
  // PDF p18/p87 의 step1 헤더는 'Ceiling Height' 로 잘못 표기돼 있고 실제 카드는
  // Atmospheric/General lighting → 의미에 맞춰 'Lighting Purpose' 로 제목을 둔다(보고서에 명시).
  function rPurpose() { return { key: "purpose", title: "Lighting Purpose", cards: RCARD.purpose }; }
  function rPurposeCorridor() { return { key: "purpose", title: "Lighting Purpose", cards: RCARD.purposeCorridor }; }
  function rFurniture() { return { key: "furniture", title: "Furniture type", cards: RCARD.furniture }; }
  function rMirror() { return { key: "mirror", title: "Mirror shape", cards: RCARD.mirror }; }
  function rInstall() { return { key: "install", title: "Install location", cards: RCARD.install }; }
  function rClosetLayout() { return { key: "lay", title: "Lighting Layout", cards: RCARD.closetLayout }; }
  function rTableSize() { return { key: "tablesize", title: "Dining table size", cards: RCARD.tableSize }; }

  // 자주 쓰는 Residential 시퀀스
  var R_RECESSED_DL = [rCH, rLayout, rFrame];   // 천장고 → 배치 → 프레임타입
  var R_CH = [rCH];
  var R_OS_WALL = [rOSWall];
  var R_OS_CEIL = [rOSCeiling];

  // ======================= HOTEL =======================
  // PDF: 260520_Optomatic_Algorithm_Hotel(EN). 천장타입/천장고 분기 없음 — 모든 조명타입은
  // 가격만(PRICE_ONLY) 이거나 단일 하위 스텝 하나뿐. 주의(비균일):
  //   · Wall indirect linear light 는 공간마다 다름 — Guest room/Bathroom 은 가격만(p12/p22),
  //     Corridor/Elevator hall 은 Opening Size 단계 있음(p25/p29).
  //   · Recessed/Square recessed downlight 도 공간마다 다름 — Guest room 은 가격만(p7/p8),
  //     Bathroom 은 Type(Dry/Wet) 단계 있음(p16/p17).
  // 이미지 폴더/파일명은 수령분 그대로 사용(@Closet, 한글 '이상' 등).
  var HIMG = "https://optomatic-light-find.vercel.app/Hotel/";
  var HCARD = {
    // Guest room _ Ceiling indirect (p11): Light box Type → Opening Size → 가격
    lightBox: [
      { title: "Linear", img: HIMG + "Hotel_CeilingIndirectLinearLtg_LtgboxType/Hotel_CeilingIndirectLinearLtg_LtgboxType_Linear.png" },
      { title: "Curved", img: HIMG + "Hotel_CeilingIndirectLinearLtg_LtgboxType/Hotel_CeilingIndirectLinearLtg_LtgboxType_Curved.png" }
    ],
    osCeiling: [
      { title: "150 ≤ D < 200 mm", img: HIMG + "Hotel_CeilingIndirectLinearLtg_OpeningSize/Hotel_CeilingIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm", img: HIMG + "Hotel_CeilingIndirectLinearLtg_OpeningSize/Hotel_CeilingIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    // Guest room _ Shelving light (p13): Install location → 가격
    install: [
      { title: "Under Shelving", img: HIMG + "Hotel_ShelvingLtg_InstallLocation/Hotel_ShelvingLtg_InstallLocation_UnderShelving.png" },
      { title: "On Shelving", img: HIMG + "Hotel_ShelvingLtg_InstallLocation/Hotel_ShelvingLtg_InstallLocation_OnShelving.png" }
    ],
    // Guest room _ Integrated linear light @Closet (p14): Lighting Layout → 가격
    closetLayout: [
      { title: "1row", img: HIMG + "Hotel_IntegratedLinearLtg@Closet_LightingLayout/Hotel_IntegratedLinearLtg@Closet_1row.jpg" },
      { title: "2rows", img: HIMG + "Hotel_IntegratedLinearLtg@Closet_LightingLayout/Hotel_IntegratedLinearLtg@Closet_2rows.jpg" }
    ],
    // Bathroom _ Recessed / Square recessed (p16/p17): Type(Dry/Wet) → 가격
    bathType: [
      { title: "Dry Area", img: HIMG + "Hotel_Bathroom_Type/Hotel_Bathroom_DryArea.png" },
      { title: "Wet Area", img: HIMG + "Hotel_Bathroom_Type/Hotel_Bathroom_WetArea.png" }
    ],
    // Bathroom _ Night light (p21): Frame Type(Trim/Trimless) → 가격. (Trimless 활성: 선택 가능)
    frameNight: [
      { title: "Trim", img: HIMG + "Hotel_NightLtg_FrameType/Hotel_NightLtg_Trim.jpg" },
      { title: "Trimless", img: HIMG + "Hotel_NightLtg_FrameType/Hotel_NightLtg_Trimless.jpg" }
    ],
    // Corridor _ Wall indirect (p25): Opening Size → 가격
    osCorridorWall: [
      { title: "150 ≤ D < 200 mm", img: HIMG + "Hotel_Corridor_WallIndirectLinearLtg_OpeningSize/Hotel_Corridor_WallIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm", img: HIMG + "Hotel_Corridor_WallIndirectLinearLtg_OpeningSize/Hotel_Corridor_WallIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    // Elevator hall _ Wall indirect (p29): Opening Size → 가격
    osElevatorWall: [
      { title: "150 ≤ D < 200 mm", img: HIMG + "Hotel_ElevatorHall_WallIndirectLinearLtg_OpeningSize/Hotel_ElevatorHall_WallIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm", img: HIMG + "Hotel_ElevatorHall_WallIndirectLinearLtg_OpeningSize/Hotel_ElevatorHall_WallIndirectLinearLtg_OpeningSize_200이상.png" }
    ]
  };

  function hLightBox() { return { key: "lbt", title: "Light box Type", cards: HCARD.lightBox }; }
  function hOSCeiling() { return { key: "os", title: "Opening Size", cards: HCARD.osCeiling }; }
  function hInstall() { return { key: "install", title: "Install location", cards: HCARD.install }; }
  function hClosetLayout() { return { key: "lay", title: "Lighting Layout", cards: HCARD.closetLayout }; }
  function hBathType() { return { key: "type", title: "Type", cards: HCARD.bathType }; }
  function hFrameNight() { return { key: "ft", title: "Frame Type", cards: HCARD.frameNight }; }
  function hOSCorridorWall() { return { key: "os", title: "Opening Size", cards: HCARD.osCorridorWall }; }
  function hOSElevatorWall() { return { key: "os", title: "Opening Size", cards: HCARD.osElevatorWall }; }

  // ======================= MUSEUM / GALLERY =======================
  // PDF: 260520_Optomatic_Algorithm_MuseumGallery(EN). 위저드에 Venue(Museum/Gallery)
  // 단계가 추가됨(Figma 11:108). 현재 활성 흐름은 Exhibition Hall_Track System 하나:
  //   step1 Mood(Neutral/Focus) → step2 Ceiling Height(4밴드) → step3 Lighting Effect
  //   → (자동) Fixture Price.
  // Venue 분기: Gallery 는 Mood 의 Focus 카드가 비활성(p8). 그래서 Track System 흐름은
  //   venue 를 받아 Mood 를 만드는 *함수형 흐름*(아래 mgTrack)으로 정의하고,
  //   LF_STEPS 가 함수면 venue 를 넘겨 호출한다.
  // Lighting Effect 는 Mood 선택에 따라 분기: Neutral→Spot/Wallwasher, Focus→Spot/Framer.
  // 이미지: assets/light_find/MuseumGallery/ (천장고는 단일 다이어그램 1장 공유).
  var MGIMG = "https://optomatic-light-find.vercel.app/MuseumGallery/";
  var MG = {
    moodNeutral: MGIMG + "MuseumGallery_ExhibitionHall_Mood/MuseumGallery_ExhibitionHall_Mood_Neutral.jpg",
    moodFocus:   MGIMG + "MuseumGallery_ExhibitionHall_Mood/MuseumGallery_ExhibitionHall_Mood_Focus.jpg",
    ch:          MGIMG + "MuseumGallery_ExhibitionHall_CeilingHeight/MuseumGallery_ExhibitionHall_CeilingHeight.jpg",
    neutralSpot: MGIMG + "MuseumGallery_ExhibitionHall_LightEffect/MuseumGallery_ExhibitionHall_Neutral_Spot.jpg",
    neutralWall: MGIMG + "MuseumGallery_ExhibitionHall_LightEffect/MuseumGallery_ExhibitionHall_Neutral_Wallwasher.jpg",
    focusSpot:   MGIMG + "MuseumGallery_ExhibitionHall_LightEffect/MuseumGallery_ExhibitionHall_Focus_Spot.jpg",
    focusFramer: MGIMG + "MuseumGallery_ExhibitionHall_LightEffect/MuseumGallery_ExhibitionHall_Focus_Framer.jpg"
  };
  // PDF 카드 하단 빨간 Note 문구(요청: 카드 sub 텍스트로 노출). Framer 문구는 PDF 에서 잘림.
  var MGN = {
    neutral:    "Uniform illuminance and low luminance contrast across the space create a stable viewing environment.",
    focus:      "Enhances artwork focus through light and shadow contrast for a dramatic atmosphere.",
    spot:       "Illuminates the artwork to guide the viewer’s gaze",
    wallwasher: "Creates a uniform brightness across the wall surface.",
    framer:     "Shapes and focuses light to highlight an artwork’s size and contours with minimal" // PDF 원문 잘림
  };

  function mgMood(venue) {
    // Gallery 는 Focus 비활성(p8). venue 는 흐름 생성 시점에 고정(클로저).
    return function () {
      return { key: "mood", title: "Mood", cards: [
        { title: "Neutral", sub: MGN.neutral, img: MG.moodNeutral },
        { title: "Focus", sub: MGN.focus, img: MG.moodFocus, disabled: venue === "Gallery" }
      ] };
    };
  }
  function mgCeilingHeight() {
    return { key: "ch", title: "Ceiling Height", cards: [
      { title: "Standard",      sub: "2400 ≤ CH < 3000 mm", img: MG.ch },
      { title: "High",          sub: "3000 ≤ CH < 4000 mm", img: MG.ch },
      { title: "Very High",     sub: "4000 ≤ CH < 6000 mm", img: MG.ch },
      { title: "Atrium Height", sub: "CH ≥ 6000 mm",         img: MG.ch }
    ] };
  }
  function mgLightingEffect(sel) {
    var focus = sel["Mood"] === "Focus";
    var cards = focus ? [
      { title: "Spot light",   sub: MGN.spot,   img: MG.focusSpot },
      { title: "Framer light", sub: MGN.framer, img: MG.focusFramer }
    ] : [
      { title: "Spot light",      sub: MGN.spot,       img: MG.neutralSpot },
      { title: "Wallwasher light", sub: MGN.wallwasher, img: MG.neutralWall }
    ];
    return { key: "le", title: "Lighting Effect", cards: cards };
  }
  // venue 의존 흐름: Mood(venue) → Ceiling Height → Lighting Effect.
  function mgTrack(venue) { return [mgMood(venue), mgCeilingHeight, mgLightingEffect]; }

  // ======================= RETAIL =======================
  // PDF: 260425_Optomatic_Algorithm_Retail(EN). 상세 알고리즘은 Sales Area 한 공간만
  // 제공된다(Window Display / Fitting Room 은 상세 페이지 없음 → options 에서 disabled).
  // 천장고는 3밴드: Standard(2600≤CH≤2800) / Semi-High(2800<CH≤3200) / High(3200<CH≤3500).
  //   · PDF 페이지마다 'Semi-high/high' 와 'Semi-High/High' 표기가 섞여 있어 'Semi-High/High'
  //     로 통일했다(보고서에 명시).
  // 비균일 분기:
  //   · Track system 만 천장타입(Closed/Exposed) 분기. Closed=3밴드, Exposed=2밴드
  //     (Semi-High 3200≤CH≤3500 / High 3500≤CH≤3800). 그리고 Closed+High 일 때만
  //     Lighting type(Track System / Suspended Track system) 행 단계가 추가된다(PDF p9).
  //   · Shelving light 는 Lighting Type(Linear/Micro Spotlight/Light Panel) → Linear Light
  //     일 때만 Install location(Under/On Shelving) → 가격(PDF p15~17).
  // 이미지: assets/light_find/Retail/ (천장고 이미지 폴더는 아직 미수령 — 경로만 지정).
  var TIMG = "https://optomatic-light-find.vercel.app/Retail/";
  var TCARD = {
    // Sales Area 공통 천장고 3밴드(Recessed DL / Recessed multi spot DL / Recessed Track / Barrisol).
    ch: [
      { title: "Standard",  sub: "2600 ≤ CH ≤ 2800 mm", img: TIMG + "standard.jpeg" },
      { title: "Semi-High", sub: "2800 < CH ≤ 3200 mm", img: TIMG + "semi-high.jpeg" },
      { title: "High",      sub: "3200 < CH ≤ 3500 mm", img: TIMG + "high.jpeg" }
    ],
    ceilingType: [
      { title: "Closed Ceiling",  img: TIMG + "Retail_CeilingType/Retail_CeilingType_Closed.png" },
      { title: "Exposed Ceiling", img: TIMG + "Retail_CeilingType/Retail_CeilingType_Exposed.png" }
    ],
    // Track system_Exposed 전용 2밴드(PDF p10). 전용 이미지 미수령 → semi-high/high 재사용(임시).
    chExposed: [
      { title: "Semi-High", sub: "3200 ≤ CH ≤ 3500 mm", img: TIMG + "semi-high.jpeg" },
      { title: "High",      sub: "3500 ≤ CH ≤ 3800 mm", img: TIMG + "high.jpeg" }
    ],
    layout: [
      { title: "Single layout", img: TIMG + "Retail_LightingLayout/Retail_LightingLayout_Single.png" },
      { title: "Double layout", img: TIMG + "Retail_LightingLayout/Retail_LightingLayout_Double.png" }
    ],
    lightBox: [
      { title: "Linear", img: TIMG + "Retail_CeilingIndirectLinearLtg_LtgboxType/Retail_CeilingIndirectLinearLtg_LtgboxType_Linear.png" },
      { title: "Curved", img: TIMG + "Retail_CeilingIndirectLinearLtg_LtgboxType/Retail_CeilingIndirectLinearLtg_LtgboxType_Curved.png" }
    ],
    osCeiling: [
      { title: "150 ≤ D < 200 mm", img: TIMG + "Retail_CeilingIndirectLinearLtg_OpeningSize/Retail_CeilingIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm",       img: TIMG + "Retail_CeilingIndirectLinearLtg_OpeningSize/Retail_CeilingIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    osWall: [
      { title: "150 ≤ D < 200 mm", img: TIMG + "Retail_WallIndirectLinearLtg_OpeningSize/Retail_WallIndirectLinearLtg_OpeningSize_150-200.png" },
      { title: "D ≥ 200 mm",       img: TIMG + "Retail_WallIndirectLinearLtg_OpeningSize/Retail_WallIndirectLinearLtg_OpeningSize_200이상.png" }
    ],
    shelvingType: [
      { title: "Linear Light",   img: TIMG + "Retail_ShelvingLtg_LtgType/Retail_ShelvingLtg_LtgType_LinearLtg.png" },
      { title: "Micro Spotlight", img: TIMG + "Retail_ShelvingLtg_LtgType/Retail_ShelvingLtg_LtgType_MircoSpotLtg.png" },
      { title: "Light Panel",    img: TIMG + "Retail_ShelvingLtg_LtgType/Retail_ShelvingLtg_LtgType_LtgPanel.png" }
    ],
    shelvingInstall: [
      { title: "Under Shelving", img: TIMG + "Retail_ShelvingLtg_InstallLocation/Retail_ShelvingLtg_InstallLocation_UnderShelving.png" },
      { title: "On Shelving",    img: TIMG + "Retail_ShelvingLtg_InstallLocation/Retail_ShelvingLtg_InstallLocation_OnShelving.png" }
    ],
    // Integrated linear light @Garment rack (PDF p18) — 폴더/파일명은 수령분 그대로(@Closet, 2row, Garment rack).
    garmentInstall: [
      { title: "1 row",       img: TIMG + "Retail_IntegratedLinearLtg@Closet/Retail_IntegratedLinearLtg@Closet_1row.jpg" },
      { title: "2 rows",      img: TIMG + "Retail_IntegratedLinearLtg@Closet/Retail_IntegratedLinearLtg@Closet_2row.jpg" },
      { title: "Garment rail", img: TIMG + "Retail_IntegratedLinearLtg@Closet/Retail_IntegratedLinearLtg@Closet_Garment rack.jpg" }
    ]
  };
  // Track system_Closed+High 전용 Lighting type(Figma 행 디자인, 아이콘+라벨+ⓘ). 전용 SVG
  // 미수령 → 트랙 아이콘 재사용.
  var RETAIL_TRACK_LT = [ lt("Track System", LTICON.track), lt("Suspended Track system", LTICON.track) ];

  function tCH()          { return { key: "ch",  title: "Ceiling Height", cards: TCARD.ch }; }
  function tLayout()      { return { key: "lay", title: "Lighting Layout", cards: TCARD.layout }; }
  function tCeilingType() { return { key: "ct",  title: "Ceiling Type", cards: TCARD.ceilingType }; }
  // Track system 천장고: Closed=3밴드, Exposed=2밴드.
  function tTrackCH(sel)  { return { key: "ch", title: "Ceiling Height", cards: isExposed(sel) ? TCARD.chExposed : TCARD.ch }; }
  // Track system Lighting type 단계는 Closed + High 일 때만 노출(PDF p9). 그 외엔 가격 직행.
  function tTrackLightingType(sel) {
    if (isExposed(sel)) return null;
    if (sel["Ceiling Height"] !== "High") return null;
    return { key: "lt", title: "Lighting type", variant: "list", cards: RETAIL_TRACK_LT };
  }
  function tLightBox()    { return { key: "lbt", title: "Light box Type", cards: TCARD.lightBox }; }
  function tOSCeiling()   { return { key: "os",  title: "Opening Size", cards: TCARD.osCeiling }; }
  function tOSWall()      { return { key: "os",  title: "Opening Size", cards: TCARD.osWall }; }
  function tShelvingType(){ return { key: "stype", title: "Lighting Type", cards: TCARD.shelvingType }; }
  // Install location 단계는 Linear Light 일 때만(PDF p15). Micro Spotlight/Light Panel 은 가격 직행.
  function tShelvingInstall(sel) {
    if (sel["Lighting Type"] !== "Linear Light") return null;
    return { key: "install", title: "Install location", cards: TCARD.shelvingInstall };
  }
  function tGarmentInstall() { return { key: "install", title: "Install location", cards: TCARD.garmentInstall }; }

  var T_CH_LAY = [tCH, tLayout];
  var T_TRACK  = [tCeilingType, tTrackCH, tTrackLightingType];

  // ── 공간 × 조명타입 → 시퀀스 (PDF 기준) ───────────────────────────────
  var FLOWS = {
   "Office": {
    "Workspace": {
      "Select a type": WORKSPACE_GENERAL,
      "Task light": PRICE_ONLY,
      "Wall indirect linear light": OS,
      "Linear uplight @Raceway": PRICE_ONLY
    },
    "Executive office": {
      "Recessed downlight": CH_LAY,
      "Recessed multi spot downlight": CH_LAY,
      "Magnetic track system": CH,
      "Task light": PRICE_ONLY,
      "Pendant light": PRICE_ONLY,
      "Wall indirect linear light": OS
    },
    "Meeting room": {
      "Recessed downlight": CH_LAY,
      "Recessed multi spot downlight": CH_LAY,
      "Magnetic track system": CH,
      "Pendant light": PRICE_ONLY,
      "Wall indirect linear light": OS
    },
    "Seminar room": {
      "Recessed downlight": CH,
      "Recessed linear light": CH,
      "Recessed multi spot downlight": CH,
      "Magnetic track system": CH,
      "Wall indirect linear light": OS
    },
    "Canteen": {
      "Recessed downlight": CH_LAY,
      "Track system": CT_CH,
      "Surface mounted downlight": CH,
      "Pendant light": PRICE_ONLY,
      "Wall indirect linear light": OS
    },
    "Corridor": {
      "Recessed downlight": CH,
      "Recessed linear light": CH,
      "Surface mounted downlight": CH,
      "Surface mounted linear light": CH,
      "Suspended linear light": [ceilingType, ceilingHeightSuspended],
      "Track system": CT_CH,
      "Wall indirect linear light": OS
    },
    "Restroom": {
      "Recessed downlight": CH,
      "Linear light @Slot": PRICE_ONLY,
      "Wall indirect linear light": OS,
      "Linear light @under Mirror": PRICE_ONLY,
      "Linear light @under Sink": PRICE_ONLY
    }
   },
   "Residential": {
    "Living room": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Semi recessed downlight": R_CH,
      "Magnetic track system": R_CH,
      "Wall mounted light": [rPurpose],
      "Floor light": R_CH,
      "Pendant light": R_CH,
      "Table light": [rFurniture],
      "Ceiling indirect linear light": [rLightBox, rOSCeiling],
      "Wall indirect linear light": R_OS_WALL
    },
    "Bedroom": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Semi recessed downlight": R_CH,
      "Magnetic track system": R_CH,
      "Pendant light @Bedside table": PRICE_ONLY,
      "Table light @Bedside table": PRICE_ONLY,
      "Reading light @Headboard": PRICE_ONLY,
      "Floor light": R_CH,
      "Table light": PRICE_ONLY,
      "Linear uplight @Headboard": PRICE_ONLY,
      "Night light": [rFrameNight],
      "Ceiling indirect linear light": R_OS_CEIL,
      "Wall indirect linear light": R_OS_WALL
    },
    "Study room": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Linear light @Slot": PRICE_ONLY,
      "Task light": PRICE_ONLY,
      "Ceiling indirect linear light": R_OS_CEIL,
      "Wall indirect linear light": R_OS_WALL
    },
    "Dress room": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Magnetic track system": R_CH,
      "Shelving light": [rInstall],
      "Integrated linear light @Closet": [rClosetLayout],
      "Ceiling indirect linear light": R_OS_CEIL,
      "Wall indirect linear light": R_OS_WALL
    },
    "Powder room": {
      "Wall mounted light @Mirror": [rMirror]
    },
    "Kitchen": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Surface mounted downlight": R_CH,
      "Magnetic track system": R_CH,
      "Recessed linear light": R_CH,
      "Linear light @Slot": PRICE_ONLY,
      "Linear light @under Cabinet": PRICE_ONLY,
      "Shelving light": [rInstall],
      "Wall indirect linear light": R_OS_WALL
    },
    "Dining room": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Pendant light": [rTableSize],
      "Wall mounted pendant light": PRICE_ONLY,
      "Wall indirect linear light": R_OS_WALL
    },
    "Bathroom": {
      "Recessed downlight": [rFrame],   // PDF p72: 프레임타입만(천장고/배치 없음)
      "Linear light @Slot": PRICE_ONLY,
      "Night light": [rFrameNight],
      "Pendant light @Mirror": PRICE_ONLY,
      "Wall mounted light @Mirror": [rMirror],
      "Linear light @under Mirror": PRICE_ONLY,
      "Mirror light": PRICE_ONLY,
      "Linear light @under Sink": PRICE_ONLY,
      "Wall indirect linear light": R_OS_WALL
    },
    "Corridor": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Linear light @Slot": PRICE_ONLY,
      "Night light": [rFrameNight],
      "Wall indirect linear light": R_OS_WALL,
      "Wall mounted light": [rPurposeCorridor]
    },
    "Entrance": {
      "Recessed downlight": R_RECESSED_DL,
      "Recessed multi spot downlight": R_CH,
      "Linear light @Slot": PRICE_ONLY,
      "Linear light @Shoe closet": PRICE_ONLY,
      "Indirect linear light @under Shoe closet": PRICE_ONLY,
      "Wall indirect linear light": R_OS_WALL
    }
   },
   // 키는 위저드 Project 버튼 라벨과 정확히 일치해야 함 → "Hotel / Resorts"
   "Hotel / Resorts": {
    "Guest room": {
      "Recessed downlight": PRICE_ONLY,                    // p7  가격만
      "Square recessed downlight": PRICE_ONLY,             // p8  가격만
      "Reading light @Headboard": PRICE_ONLY,              // p9  가격만
      "Linear uplight @Headboard": PRICE_ONLY,             // p10 가격만
      "Ceiling indirect linear light": [hLightBox, hOSCeiling], // p11 라이트박스 → 개구부
      "Wall indirect linear light": PRICE_ONLY,            // p12 가격만(게스트룸)
      "Shelving light": [hInstall],                        // p13 설치위치
      "Integrated linear light @Closet": [hClosetLayout]   // p14 배치(1row/2rows)
    },
    "Bathroom": {
      "Recessed downlight": [hBathType],                   // p16 Type(Dry/Wet)
      "Square recessed downlight": [hBathType],            // p17 Type(Dry/Wet)
      "Linear light @under Mirror": PRICE_ONLY,            // p18 가격만
      "Mirror light": PRICE_ONLY,                          // p19 가격만
      "Linear light @under Sink": PRICE_ONLY,              // p20 가격만
      "Night light": [hFrameNight],                        // p21 Frame Type(Trim/Trimless)
      "Wall indirect linear light": PRICE_ONLY             // p22 가격만(욕실)
    },
    "Corridor": {
      "Recessed downlight": PRICE_ONLY,                    // p24 가격만
      "Wall indirect linear light": [hOSCorridorWall],     // p25 개구부
      "Floor indirect linear light": PRICE_ONLY            // p26 가격만
    },
    "Elevator hall": {
      "Recessed downlight": PRICE_ONLY,                    // p28 가격만
      "Wall indirect linear light": [hOSElevatorWall]      // p29 개구부
    }
   },
   // 키는 위저드 Project 버튼 라벨과 정확히 일치해야 함 → "Museum / Gallery".
   // Track System 흐름은 venue 의존(함수) → LF_STEPS 가 venue 를 넘겨 호출.
   "Museum / Gallery": {
    "Exhibition Hall": {
      "Track System": mgTrack                              // Mood → Ceiling Height → Lighting Effect
    }
   },
   // Figma 14:2 / PDF: 260425_Optomatic_Algorithm_Retail(EN). 최상위 프로젝트는 "Commercial",
   // Venue(Retail/F&B) 아래 Retail·Sales Area 한 공간만 상세 제공(나머지는 disabled). 흐름은
   // venue 와 무관 → LF_STEPS 의 venue 인자는 무시. General 2번째는 Figma 기준 "Recessed multi
   // spot downlight"(PDF "Semi recessed downlight" 자리, 동일 흐름).
   "Commercial": {
    "Sales Area": {
      "Recessed downlight": T_CH_LAY,                      // p4  천장고 → 배치
      "Recessed multi spot downlight": T_CH_LAY,           // p5  천장고 → 배치(Figma 라벨)
      "Recessed Track system": [tCH],                      // p6  천장고만
      "Track System": T_TRACK,                             // p7~10 천장타입 → 천장고 → (Closed·High 면 Lighting type)
      "Barrisol light": [tCH],                             // p11 천장고만
      "Linear uplight @Raceway": PRICE_ONLY,               // p12 가격만
      "Ceiling indirect linear light": [tLightBox, tOSCeiling], // p13 라이트박스 → 개구부
      "Wall indirect linear light": [tOSWall],             // p14 개구부
      "Shelving light": [tShelvingType, tShelvingInstall], // p15~17 조명타입 → (Linear 면 설치위치)
      "Integrated linear light @Garment rack": [tGarmentInstall], // p18 설치위치(1row/2rows/Garment rail)
      "Linear light @under Display table": PRICE_ONLY      // p19 가격만
    }
   }
  };

  // venue: Museum/Gallery 등 Venue 단계가 있는 프로젝트에서만 전달(그 외 undefined).
  window.LF_STEPS = function (project, space, lighting, venue) {
    var byproject = FLOWS[project];
    if (!byproject) return null;          // 프로젝트 정의 없으면 null (정적 폴백)
    var byspace = byproject[space];
    if (!byspace) return null;            // 공간 정의 없으면 null
    var flow = byspace[lighting];
    if (flow == null) return PRICE_ONLY;
    if (typeof flow === "function") return flow(venue);   // venue 의존 흐름(Museum)
    return flow;
  };
})();
