export type StatusVariant = "empty-cart" | "empty-orders" | "not-found" | "forbidden" | "need-login" | "server-error";
export const STATUS_COPY: Record<StatusVariant, { emphasis:string; title:string; description:string; color:string; image:string; actions:{label:string;href:string}[] }> = {
 "empty-cart": {emphasis:"텅",title:"장바구니가 비어 있어요",description:"좋아하는 아티스트의 굿즈를 담아보세요.",color:"#00a992",image:"/status/moa-empty-cart.svg",actions:[{label:"굿즈 보러가기",href:"/products"},{label:"찜한 상품",href:"/wishlist"}]},
 "empty-orders": {emphasis:"아직",title:"주문한 굿즈가 없어요",description:"첫 주문을 기다리고 있어요.",color:"#00a992",image:"/status/moa-empty-orders.svg",actions:[{label:"인기 굿즈 보기",href:"/products"}]},
 "not-found": {emphasis:"어라?",title:"찾는 페이지가 없어요",description:"주소가 바뀌었거나 판매가 끝났을 수 있어요.",color:"#8a70df",image:"/status/moa-not-found.svg",actions:[{label:"전체 상품 보기",href:"/products"},{label:"홈으로",href:"/"}]},
 "forbidden": {emphasis:"쉿",title:"관리자만 들어올 수 있어요",description:"관리자 계정으로 다시 로그인해주세요.",color:"#e35d9b",image:"/status/moa-forbidden.svg",actions:[{label:"관리자 로그인",href:"/login"},{label:"쇼핑하러 가기",href:"/products"}]},
 "need-login": {emphasis:"잠깐!",title:"로그인하고 이어서 볼게요",description:"로그인하면 보던 화면으로 돌아와요.",color:"#8a70df",image:"/status/moa-need-login.svg",actions:[{label:"로그인하기",href:"/login"}]},
 "server-error": {emphasis:"끙…",title:"잠깐 숨 고르는 중이에요",description:"조금 뒤 다시 시도해주세요.",color:"#73767c",image:"/status/moa-server-error.svg",actions:[{label:"홈으로",href:"/"}]},
};
