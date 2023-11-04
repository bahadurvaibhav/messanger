import { ClientProxy } from '@nestjs/microservices';
import { Inject, Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import {
  MessagesRepositoryInterface,
  ConversationsRepositoryInterface,
  UserEntity,
} from '@app/shared';

import { NewMessageDTO } from './dtos/NewMessage.dto';

@Injectable()
export class ChatService {
  constructor(
    @Inject('ConversationsRepositoryInterface')
    private readonly conversationsRepository: ConversationsRepositoryInterface,
    @Inject('MessagesRepositoryInterface')
    private readonly messagesRepository: MessagesRepositoryInterface,
    @Inject('AUTH_SERVICE') private readonly authService: ClientProxy,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  private async getUser(id: number) {
    const ob$ = this.authService.send<UserEntity>(
      {
        cmd: 'get-user',
      },
      { id },
    );

    const user = await firstValueFrom(ob$).catch((err) => console.error(err));

    return user;
  }

  async getConversations(userId: number) {
    const allConversations =
      await this.conversationsRepository.findWithRelations({
        relations: ['users'],
      });

    const userConversations = allConversations.filter((conversation) => {
      const userIds = conversation.users.map((user) => user.id);
      return userIds.includes(userId);
    });

    return userConversations.map((conversation) => ({
      id: conversation.id,
      userIds: (conversation?.users ?? []).map((user) => user.id),
    }));
  }

  async createConversation(userId: number, friendId: number) {
    const user = await this.getUser(userId);
    const friend = await this.getUser(friendId);

    if (!user || !friend) return;

    const conversation = await this.conversationsRepository.findConversation(
      userId,
      friendId,
    );

    if (!conversation) {
      return await this.conversationsRepository.save({
        users: [user, friend],
      });
    }

    return conversation;
  }

  async createMessage(userId: number, newMessage: NewMessageDTO) {
    console.log('userID: ', userId);

    const user = await this.getUser(userId);

    if (!user) return;

    const conversation = await this.conversationsRepository.findByCondition({
      where: [{ id: newMessage.conversationId }],
      relations: ['users'],
    });

    if (!conversation) return;
    console.log('conversation: ', conversation);

    return await this.messagesRepository.save({
      message: newMessage.message,
      user,
      conversation,
    });
  }

  async getChat(userId: number, conversationId: number, skip: number) {
    console.log('userID: ', userId);
    console.log('skip: ', skip);

    const user = await this.getUser(userId);

    if (!user) return;

    // const conversation = await this.conversationsRepository.findByCondition({
    //   where: [{ id: conversationId }],
    //   relations: ['users'],
    // });

    // if (!conversation) return;

    const convv = await this.messagesRepository.findWithRelations({
      where: { conversation: { id: conversationId } },
      relations: ['user', 'conversation'],
      loadRelationIds: true,
      order: { createdAt: 'ASC' },
      skip: skip || 0,
      take: 20,
    });
    // if (!convv) return { status: true, data: [] };
    console.log(convv);

    // const userChat = convv.filter((conversation) => {
    //   const userIds = conversation.conversation.id;
    //   return userIds == conversationId;
    // });

    return { status: true, conversationId, data: convv };
  }
}
