from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.presentation.dependencies import CurrentUser, get_current_user
from core.errors import ApiError
from database import get_session
from products.application.discovery_service import DiscoveryService
from products.infrastructure.discovery import DiscoveryRepository
from products.presentation.schemas import ProductSummary, summary

router = APIRouter(tags=['catalog'])
Session = Annotated[AsyncSession, Depends(get_session)]
User = Annotated[CurrentUser, Depends(get_current_user)]
Slug = Annotated[str, Path(min_length=1, max_length=100)]


class ArtistResponse(BaseModel):
    id: int
    name: str
    name_ko: str
    slug: str
    logo_path: str | None
    hero_image_path: str | None
    theme_color: str | None
    tagline: str | None


class MemberResponse(BaseModel):
    id: int
    name: str
    name_en: str
    position: str | None
    color: str | None
    mascot: str | None
    birthday: date | None
    mbti: str | None
    description: str | None
    tags: list[str]
    image_path: str | None


class ArtistBannerResponse(BaseModel):
    id: int
    title: str
    subtitle: str | None
    image_path: str
    link_path: str


class HomeBannerResponse(ArtistBannerResponse):
    slot: str
    eyebrow: str | None
    badge: str | None


class NoticeResponse(BaseModel):
    id: int
    artist_slug: str | None
    title: str
    body: str | None
    product_id: int | None
    is_pinned: bool
    show_in_topbar: bool
    published_at: datetime


class ShopSettingsResponse(BaseModel):
    free_shipping_threshold: int
    shipping_fee: int
    ship_days_text: str
    company_name: str
    ceo_name: str
    business_number: str
    ecommerce_number: str
    address: str
    cs_phone: str
    cs_hours: str


class BestProductResponse(ProductSummary):
    rank: int


class ArtistLikeResponse(BaseModel):
    artist_id: int
    is_liked: bool
    count: int


@router.get('/artists', response_model=list[ArtistResponse])
async def artists(session: Session):
    return await DiscoveryRepository(session).artists()


@router.get('/artists/like-counts', response_model=dict[int, int])
async def like_counts(session: Session):
    return {r['artist_id']:r['count'] for r in await DiscoveryRepository(session).like_counts()}


async def artist_or_404(session, slug):
    try: return await DiscoveryService(session).artist(slug)
    except LookupError as error: raise ApiError(404, 'UNKNOWN', str(error)) from error


@router.get('/artists/{slug}', response_model=ArtistResponse)
async def artist(slug: Slug, session: Session):
    return await artist_or_404(session, slug)


@router.get('/artists/{slug}/members', response_model=list[MemberResponse])
async def members(slug: Slug, session: Session):
    await artist_or_404(session, slug)
    return await DiscoveryRepository(session).members(slug)


@router.get('/artists/{slug}/banners', response_model=list[ArtistBannerResponse])
async def banners(slug: Slug, session: Session):
    await artist_or_404(session, slug)
    return await DiscoveryRepository(session).banners(slug)


@router.get('/artists/{slug}/like', response_model=ArtistLikeResponse)
async def liked(slug: Slug, user: User, session: Session, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    row = await artist_or_404(session, slug)
    repo = DiscoveryRepository(session)
    counts = {r['artist_id']:r['count'] for r in await repo.like_counts()}
    return {'artist_id':row['id'], 'is_liked':await repo.liked(user.id,row['id']), 'count':counts.get(row['id'],0)}


async def set_liked(slug, user, session, liked):
    try: return await DiscoveryService(session).set_liked(user.id, slug, liked)
    except LookupError as error: raise ApiError(404, 'UNKNOWN', str(error)) from error


@router.put('/artists/{slug}/like', response_model=ArtistLikeResponse)
async def add_like(slug: Slug, user: User, session: Session, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    return await set_liked(slug, user, session, True)


@router.delete('/artists/{slug}/like', response_model=ArtistLikeResponse)
async def remove_like(slug: Slug, user: User, session: Session, response: Response):
    response.headers['Cache-Control'] = 'private, no-store'
    return await set_liked(slug, user, session, False)


@router.get('/home-banners', response_model=list[HomeBannerResponse])
async def home_banners(session: Session):
    return await DiscoveryRepository(session).home_banners()


@router.get('/notices/topbar', response_model=NoticeResponse | None)
async def topbar(session: Session):
    rows = await DiscoveryRepository(session).notices(topbar=True, limit=1)
    return rows[0] if rows else None


@router.get('/notices', response_model=list[NoticeResponse])
async def notices(session: Session, artist: Annotated[str | None, Query(max_length=100)]=None,
                  limit: Annotated[int, Query(ge=1,le=100)]=20):
    return await DiscoveryRepository(session).notices(artist=artist,limit=limit)


@router.get('/notices/{notice_id}', response_model=NoticeResponse)
async def notice(notice_id: Annotated[int, Path(ge=1,le=9_223_372_036_854_775_807)], session: Session,
                 artist: Annotated[str | None, Query(max_length=100)]=None):
    rows = await DiscoveryRepository(session).notices(artist=artist,notice_id=notice_id,limit=1)
    if not rows: raise ApiError(404,'UNKNOWN','공지를 찾을 수 없어요.')
    return rows[0]


@router.get('/shop-settings', response_model=ShopSettingsResponse)
async def settings(session: Session):
    row = await DiscoveryRepository(session).settings()
    if row is None: raise ApiError(503,'UNKNOWN','쇼핑몰 설정을 불러올 수 없어요.')
    return row


@router.get('/products/best', response_model=list[BestProductResponse])
async def best(session: Session, days: Annotated[int, Query(ge=1,le=365)]=7,
               limit: Annotated[int, Query(ge=1,le=50)]=8,
               artist: Annotated[str | None, Query(max_length=100)]=None):
    products = await DiscoveryRepository(session).best(days,limit,artist)
    return [BestProductResponse(**summary(p).model_dump(),rank=i+1) for i,p in enumerate(products)]
