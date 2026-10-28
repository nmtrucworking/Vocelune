import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthRequest, id } from '../common/http';
import { Public } from '../identity/security';
import { VocabularyService } from './vocabulary.service';
@ApiTags('Vocabulary')
@Controller()
export class VocabularyController {
  constructor(@Inject(VocabularyService) private vocabulary: VocabularyService) {}
  @Get('vocabulary') list(@Req() r: AuthRequest, @Query() q: unknown) { return this.vocabulary.list(r.auth.userId, q); }
  @Post('vocabulary') create(@Req() r: AuthRequest, @Body() b: unknown) { return this.vocabulary.create(r.auth.userId, b); }
  @Post('vocabulary/duplicate-preview') duplicates(@Req() r: AuthRequest, @Body() b: unknown) { return this.vocabulary.duplicatePreview(r.auth.userId, b); }
  @Post('vocabulary/merge') merge(@Req() r: AuthRequest, @Body() b: unknown) { return this.vocabulary.merge(r.auth.userId, b); }
  @Get('vocabulary/:id') get(@Req() r: AuthRequest, @Param('id') v: string) { return this.vocabulary.get(r.auth.userId, id(v)); }
  @Patch('vocabulary/:id') update(@Req() r: AuthRequest, @Param('id') v: string, @Body() b: unknown) { return this.vocabulary.update(r.auth.userId, id(v), b); }
  @Delete('vocabulary/:id') remove(@Req() r: AuthRequest, @Param('id') v: string) { return this.vocabulary.remove(r.auth.userId, id(v)); }
  @Post('vocabulary/:id/cards') card(@Req() r: AuthRequest, @Param('id') v: string, @Body() b: unknown) { return this.vocabulary.addCard(r.auth.userId, id(v), b); }
  @Get('decks') decks(@Req() r: AuthRequest) { return this.vocabulary.decks(r.auth.userId); }
  @Get('decks/groups') topicGroups(@Req() r: AuthRequest) { return this.vocabulary.topicGroups(r.auth.userId); }
  @Public() @Get('decks/public') publicDecks(@Query() q: unknown) { return this.vocabulary.publicDecks(q); }
  @Public() @Get('decks/public/:id') publicDeckPreview(@Param('id') d: string) { return this.vocabulary.publicDeckPreview(id(d)); }
  @Post('decks/public/:id/fork') forkDeck(@Req() r: AuthRequest, @Param('id') d: string, @Body() b: unknown) { return this.vocabulary.forkDeck(r.auth.userId, id(d), b); }
  @Post('decks') createDeck(@Req() r: AuthRequest, @Body() b: unknown) { return this.vocabulary.createDeck(r.auth.userId, b); }
  @Patch('decks/:id') updateDeck(@Req() r: AuthRequest, @Param('id') d: string, @Body() b: unknown) { return this.vocabulary.updateDeck(r.auth.userId, id(d), b); }
  @Delete('decks/:id') deleteDeck(@Req() r: AuthRequest, @Param('id') d: string) { return this.vocabulary.deleteDeck(r.auth.userId, id(d)); }
}
