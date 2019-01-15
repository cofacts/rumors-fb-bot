import gql from '../gql';
import {
  createPostbackAction,
  createFeedbackWords,
  createTypeWords,
  isNonsenseText,
  getArticleURL,
  createAskArticleSubmissionReply,
} from './utils';
import ga from '../ga';

/**
 * We reorder the replies queried and put them into a reply list.
 * Replies indicating truth or rumor are listed first.
 * If the reply list is not yet full, we then add the 'NOT_ARTICLE' replies.
 * If this article has more than 10 replies, we put a 'read more' block
 * that links to our website at the end of the reply list.
 */
function reorderArticleReplies(articleReplies) {
  const replies = [];
  const notArticleReplies = [];

  for (let articleReply of articleReplies) {
    if (articleReply.reply.type !== 'NOT_ARTICLE') {
      replies.push(articleReply);
    } else {
      notArticleReplies.push(articleReply);
    }
  }
  return replies.concat(notArticleReplies);
}

/**
 * The state that we're processing user input,
 * and the the user should choose which article matches what she's seeking.
 * If she hasn't chosen one, we ask her to select the desired reply.
 * If she has, we query replies of the article and ask her to choose those she wants to read.
 * If we didn't find any reply, we ask the user to tell us why she thinks this should be replied sooner.
 */
export default async function choosingArticle(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.foundArticleIds) {
    throw new Error('foundArticleIds not set in data');
  }

  data.selectedArticleId = data.foundArticleIds[event.input - 1];
  const { selectedArticleId } = data;
  const doesNotContainMyArticle = +event.input === 0;

  if (doesNotContainMyArticle && isNonsenseText(data.searchedText)) {
    replies = [
      {
        type: 'text',
        content: {
          text:
            // Sorry, please provide more information.
            // Please refer to our user's manual http://bit.ly/cofacts-fb-users
            '剛才您傳的訊息資訊量太少，編輯無從查證。\n' +
            '查證範圍請參考📖使用手冊 http://bit.ly/cofacts-fb-users',
        },
      },
    ];
    state = '__INIT__';
  } else if (doesNotContainMyArticle) {
    replies = createAskArticleSubmissionReply();

    state = 'ASKING_ARTICLE_SUBMISSION_REASON';
  } else if (!selectedArticleId) {
    replies = [
      {
        type: 'text',
        content: {
          // Please enter 1 - {length} to choose a reply
          text: `請輸入 1～${data.foundArticleIds.length} 的數字，來選擇訊息。`,
        },
      },
    ];

    state = 'CHOOSING_ARTICLE';
  } else {
    const {
      data: { GetArticle },
    } = await gql`
      query($id: String!) {
        GetArticle(id: $id) {
          replyCount
          text
          articleReplies(status: NORMAL) {
            reply {
              id
              type
              text
            }
            positiveFeedbackCount
            negativeFeedbackCount
          }
        }
      }
    `({
      id: selectedArticleId,
    });

    data.selectedArticleText = GetArticle.text;
    const visitor = ga('FB-' + userId, data.selectedArticleText);
    visitor.screenview({ screenName: state });

    // Track which Article is selected by user.
    visitor.event({
      ec: 'Article',
      ea: 'Selected',
      el: selectedArticleId,
      dt: data.selectedArticleText,
    });

    const count = {};

    GetArticle.articleReplies.forEach(ar => {
      // Track which Reply is searched. And set tracking event as non-interactionHit.
      visitor.event({ ec: 'Reply', ea: 'Search', el: ar.reply.id, ni: true });

      const type = ar.reply.type;
      if (!count[type]) {
        count[type] = 1;
      } else {
        count[type]++;
      }
    });

    const articleReplies = reorderArticleReplies(GetArticle.articleReplies);
    const summary =
      '這個訊息有：\n' +
      // {} person(s) consider this to be a rumor
      `${count.RUMOR || 0} 則回應標成 ❌ 含有不實訊息\n` +
      // {} person(s) think this can be a truth
      `${count.NOT_RUMOR || 0} 則回應標成 ⭕ 含有真實訊息\n` +
      // {} person(s) think this is simply personal opinion
      `${count.OPINIONATED || 0} 則回應標成 💬 含有個人意見\n` +
      // {} person(s) thinks Cofacts need not to handle this message
      `${count.NOT_ARTICLE || 0} 則回應標成 ⚠️️ 不在查證範圍\n`;

    replies = [
      {
        type: 'text',
        content: {
          text: summary,
        },
      },
    ];

    if (articleReplies.length !== 0) {
      data.foundReplyIds = articleReplies.map(({ reply }) => reply.id);

      state = 'CHOOSING_REPLY';

      if (articleReplies.length === 1) {
        // choose for user
        event.input = 1;

        return {
          data,
          state: 'CHOOSING_REPLY',
          event,
          issuedAt,
          userId,
          replies,
          isSkipUser: true,
        };
      }

      const templateMessage = {
        type: 'template',
        //altText: createAltText(articleReplies),
        payload: {
          template_type: 'generic',
          elements: articleReplies
            .slice(0, 10)
            .map(
              (
                { reply, positiveFeedbackCount, negativeFeedbackCount },
                idx
              ) => ({
                subtitle:
                  createTypeWords(reply.type) +
                  '\n' +
                  createFeedbackWords(
                    positiveFeedbackCount,
                    negativeFeedbackCount
                  ),
                title: reply.text.slice(0, 80),
                // Read this reply
                buttons: [createPostbackAction('閱讀此回應', idx + 1)],
              })
            ),
        },
      };
      replies.push({
        type: 'carousel',
        content: {
          attachment: templateMessage,
        },
      });

      if (articleReplies.length > 10) {
        replies.push({
          type: 'text',
          content: {
            // Please refer to {articleURL} for more replies
            text: `更多回應請到：${getArticleURL(selectedArticleId)}`,
          },
        });
      }
    } else {
      // No one has replied to this yet.

      // Track not yet reply Articles.
      visitor.event({
        ec: 'Article',
        ea: 'NoReply',
        el: selectedArticleId,
      });

      const replyText =
        // Tell us about your concern
        '【跟編輯說您的疑惑】\n' +
        // Sorry no one has replied to this article yet
        '抱歉這篇訊息還沒有人回應過唷！\n' +
        '\n' +
        // If you consider this a rumor, please tell us your concern and why
        // we should figure this out as soon as possible
        '若您覺得這是一則謠言，請指出您有疑惑之處，說服編輯這是一份應該被闢謠的訊息。\n' +
        '\n';
      const promptText =
        // Please send us in messages the reason why you consider this a rumor
        '請把「為何您會覺得這是一則謠言」的理由打字傳給我們，幫助闢謠編輯釐清您有疑惑之處；\n';

      replies = [
        {
          type: 'text',
          content: {
            text: replyText,
          },
        },
        {
          type: 'text',
          content: {
            text: promptText,
          },
        },
        {
          type: 'buttons',
          content: {
            attachment: {
              type: 'template',
              payload: {
                template_type: 'button',
                // To skip this, click "Skip"
                text: '若想跳過，請按「我不想填理由」。',
                // Skip
                buttons: [createPostbackAction('我不想填理由', 'n')],
              },
            },
          },
        },
      ];

      state = 'ASKING_REPLY_REQUEST_REASON';
    }
    visitor.send();
  }

  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
