from products.infrastructure.discovery import DiscoveryRepository


class DiscoveryService:
    def __init__(self, session):
        self.session = session
        self.repository = DiscoveryRepository(session)

    async def artist(self, slug):
        artist = await self.repository.artist(slug)
        if artist is None: raise LookupError('아티스트를 찾을 수 없어요.')
        return artist

    async def set_liked(self, user_id, slug, liked):
        try:
            artist = await self.artist(slug)
            count = await self.repository.set_liked(user_id, artist['id'], liked)
            await self.session.commit()
            return {'artist_id':artist['id'], 'is_liked':liked, 'count':count}
        except BaseException:
            await self.session.rollback()
            raise
