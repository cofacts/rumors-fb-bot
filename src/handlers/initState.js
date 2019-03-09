import stringSimilarity from 'string-similarity';
import gql from '../gql';
import {
  createPostbackAction,
  isNonsenseText,
  createAskArticleSubmissionReply,
} from './utils';
import ga from '../ga';

const SIMILARITY_THRESHOLD = 0.95;

/**
 * The entry state for both messages and comments
 */
export default async function initState(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  const visitor = ga('FB-' + userId, event.input);
  visitor.screenview({ screenName: state });
  visitor.event({ ec: 'UserInput', ea: 'MessageType', el: 'text' });

  // Track text message type send by user
  visitor.event({ ec: 'UserInput', ea: 'MessageType', el: 'text' });

  // Store user input into context
  data.searchedText = event.input;

  // Search for articles
  const {
    data: { ListArticles },
  } = await gql`
    query($text: String!) {
      ListArticles(
        filter: { moreLikeThis: { like: $text } }
        orderBy: [{ _score: DESC }]
        first: 4
      ) {
        edges {
          node {
            text
            id
          }
        }
      }
    }
  `({
    text: event.input,
  });

  const articleSummary = `${event.input.slice(0, 10)}${
    event.input.length > 10 ? '⋯⋯' : ''
  }`;

  if (ListArticles.edges.length) {
    // Track if find similar Articles in DB.
    visitor.event({ ec: 'UserInput', ea: 'ArticleSearch', el: 'ArticleFound' });
    // Track which Article is searched. And set tracking event as non-interactionHit.
    ListArticles.edges.forEach(edge => {
      visitor.event({
        ec: 'Article',
        ea: 'Search',
        el: edge.node.id,
        ni: true,
      });
    });

    const edgesSortedWithSimilarity = ListArticles.edges
      .map(edge => {
        edge.similarity = stringSimilarity.compareTwoStrings(
          // Remove spaces so that we count word's similarities only
          edge.node.text.replace(/\s/g, ''),
          event.input.replace(/\s/g, '')
        );
        return edge;
      })
      .sort((edge1, edge2) => edge2.similarity - edge1.similarity);

    // Store article ids
    data.foundArticleIds = edgesSortedWithSimilarity.map(
      ({ node: { id } }) => id
    );

    const hasIdenticalDocs =
      edgesSortedWithSimilarity[0].similarity >= SIMILARITY_THRESHOLD;

    if (userId === '0') {
      // from facebook comment

      const links = edgesSortedWithSimilarity.map(
        ({ node: { id } }) => `https://cofacts.g0v.tw/article/${id}`
      );

      // search the top article
      const {
        data: { GetArticle },
      } = await gql`
        query($id: String!) {
          GetArticle(id: $id) {
            replyCount
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
        id: edgesSortedWithSimilarity[0].node.id,
      });

      const count = {};

      GetArticle.articleReplies.forEach(ar => {
        // Track which Reply is searched. And set tracking event as non-interactionHit.
        visitor.event({ ec: 'Reply', ea: 'Search', el: ar.reply.id }, true);

        const type = ar.reply.type;
        if (!count[type]) {
          count[type] = 1;
        } else {
          count[type]++;
        }
      });

      let summary =
        // and
        '，而且有：\n' +
        // {} person(s) consider this to be a rumor
        `${count.RUMOR ? `${count.RUMOR} 個人覺得 ❌ 含有不實訊息\n` : ''}` +
        // {} person(s) think this can be a truth
        `${
          count.NOT_RUMOR ? `${count.NOT_RUMOR} 個人覺得 ⭕ 含有真實訊息\n` : ''
        }` +
        // {} person(s) think this is simply personal opinion
        `${
          count.OPINIONATED
            ? `${count.OPINIONATED} 個人覺得 💬 含有個人意見\n`
            : ''
        }`;
      if (count.NOT_ARTICLE) {
        // but also {} person(s) thinks Cofacts need not to handle this message
        summary += `，不過有 ${
          count.NOT_ARTICLE
        } 個人覺得 ⚠️️ 不在 Cofacts查證範圍\n`;
      }

      const replies = [
        {
          type: 'text',
          content: {
            // Hey #Cofacts has messages {}% similar to this one! {summary}
            // Go to Cofacts' website for more information!
            // {Links}
            text: `#Cofacts 上有訊息跟這則有 ${Math.round(
              edgesSortedWithSimilarity[0].similarity * 100
            )}% 像${summary}\n到 Cofacts 上面看看相關訊息吧！\n${links.join(
              '\n'
            )}`,
          },
        },
      ];

      visitor.send();
      return {
        data,
        state,
        event,
        issuedAt,
        userId,
        replies,
        isSkipUser: false,
      };
    }

    // message
    if (edgesSortedWithSimilarity.length === 1 && hasIdenticalDocs) {
      // choose for user
      event.input = 1;

      visitor.send();
      return {
        data,
        state: 'CHOOSING_ARTICLE',
        event,
        issuedAt,
        userId,
        replies,
        isSkipUser: true,
      };
    }

    const templateMessage = {
      type: 'template',
      payload: {
        template_type: 'generic',
        elements: edgesSortedWithSimilarity
          .map(({ node: { text }, similarity }, idx) => ({
            title: text.slice(0, 80),
            // [Similarity: {}%]
            subtitle: `[相似度:${(similarity * 100).toFixed(2) + '%'}]`,
            // Choose this one
            buttons: [createPostbackAction('選擇此則', idx + 1)],
          }))
          .concat(
            hasIdenticalDocs
              ? []
              : [
                  {
                    // These messages don't match mine :(
                    title: '這裡沒有一篇是我傳的訊息。',
                    // Choose this one
                    buttons: [createPostbackAction('選擇', 0)],
                  },
                ]
          ),
      },
    };

    replies = [
      {
        type: 'text',
        content: {
          // We're checking "{articleSummary}" for you...
          text: `幫您查詢「${articleSummary}」的相關回應。`,
        },
      },
      {
        type: 'text',
        content: {
          // Which message below matches what you just sent to us?
          text: '請問下列文章中，哪一篇是您剛才傳送的訊息呢？',
        },
      },
      {
        type: 'carousel',
        content: {
          attachment: templateMessage,
          quick_replies: [
            {
              content_type: 'text',
              // I want to contact Cofacts team
              title: '我是要找 Cofacts 的人啦',
              // I want to contact Cofacts team
              payload: '我是要找 Cofacts 的人啦',
            },
          ],
        },
      },
    ];
    state = 'CHOOSING_ARTICLE';
  } else {
    if (isNonsenseText(event.input)) {
      // Track if find similar Articles in DB.
      visitor.event({
        ec: 'UserInput',
        ea: 'ArticleSearch',
        el: 'NonsenseText',
      });

      replies = [
        {
          type: 'text',
          content: {
            text:
              // Sorry, please provide more information.
              // Please refer to our user's manual http://bit.ly/cofacts-fb-users
              '你傳的資訊資訊太少，無法為你搜尋資料庫噢！\n' +
              '正確使用方式，請參考📖使用手冊 http://bit.ly/cofacts-fb-users',
          },
        },
      ];
      state = '__INIT__';
    } else {
      // Track if find similar Articles in DB.
      visitor.event({
        ec: 'UserInput',
        ea: 'ArticleSearch',
        el: 'ArticleNotFound',
      });

      if (userId === '0') {
        // from a comment
        // for issue #2, keep links in replies when nothing is found
        // since it contains less information that should be broadcast
        replies = [
          {
            type: 'text',
            content: {
              // We didn't find anything about {articleSummary} :(
              // You can try these websites again: ...
              // Or report this article to us!
              text: `找不到關於「${articleSummary}」的訊息耶 QQ\n可以嘗試到這些地方找找相關訊息：\n
              蘭姆酒吐司Rumor & Truth https://www.facebook.com/rumtoast/\n或者到 LINE 上面把謠言傳給我們~\nhttp://bit.ly/cofacts-line-users`,
            },
          },
        ];
      } else {
        replies = [
          {
            type: 'text',
            content: {
              // We didn't find anything about {articleSummary} :(
              text: `找不到關於「${articleSummary}」訊息耶 QQ`,
            },
          },
        ].concat(createAskArticleSubmissionReply());
        state = 'ASKING_ARTICLE_SUBMISSION_REASON';
      }
    }
  }

  visitor.send();
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
