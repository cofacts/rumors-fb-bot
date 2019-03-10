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
        ', and\n' +
        `${
          count.RUMOR
            ? `${count.RUMOR} user${count.RUMOR > 1 ? 's' : ''} consider${
                count.RUMOR > 1 ? '' : 's'
              } this to be a rumor ❌\n`
            : ''
        }` +
        `${
          count.NOT_RUMOR
            ? `${count.NOT_RUMOR} user${count.NOT_RUMOR > 1 ? 's' : ''} think${
                count.NOT_RUMOR > 1 ? '' : 's'
              } this can be a truth ⭕\n`
            : ''
        }` +
        // {} person(s) think this is simply personal opinion
        `${
          count.OPINIONATED
            ? `${count.OPINIONATED} user${
                count.OPINIONATED > 1 ? 's' : ''
              } think${
                count.OPINIONATED > 1 ? '' : 's'
              } this is simply a personal opinion 💬\n`
            : ''
        }`;
      if (count.NOT_ARTICLE) {
        summary += `, but ${count.NOT_ARTICLE}  user${
          count.NOT_ARTICLE > 1 ? 's' : ''
        } think${
          count.NOT_ARTICLE > 1 ? '' : 's'
        } this is off-topic and Cofacts need not to handle it ⚠️️\n`;
      }

      const replies = [
        {
          type: 'text',
          content: {
            text: `Hey #Cofacts has messages ${Math.round(
              edgesSortedWithSimilarity[0].similarity * 100
            )}similar to this one: ${summary}\nGo to Cofacts' website for more information!\n${links.join(
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
            subtitle: `[Similarity: ${(similarity * 100).toFixed(2) + '%'}]`,
            buttons: [createPostbackAction('Choose this one', idx + 1)],
          }))
          .concat(
            hasIdenticalDocs
              ? []
              : [
                  {
                    title: 'None of these messages match mine :(',
                    buttons: [createPostbackAction('Choose this one', 0)],
                  },
                ]
          ),
      },
    };

    replies = [
      {
        type: 'text',
        content: {
          text: `We're checking "${articleSummary} for you...`,
        },
      },
      {
        type: 'text',
        content: {
          text: 'Which message below matches what you just sent to us?',
        },
      },
      {
        type: 'carousel',
        content: {
          attachment: templateMessage,
          quick_replies: [
            {
              content_type: 'text',
              title: 'I want to contact Cofacts team',
              payload: 'I want to contact Cofacts team',
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
              'Sorry, please provide more information.\n' +
              "Please refer to our user's manual 📖 http://bit.ly/cofacts-fb-users",
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
              text: `We didn't find anything about "${articleSummary}" :("\nYou can try these websites again:\n
              蘭姆酒吐司Rumor & Truth https://www.facebook.com/rumtoast/\nOr report this article to us via Line! \nhttp://bit.ly/cofacts-line-users`,
            },
          },
        ];
      } else {
        replies = [
          {
            type: 'text',
            content: {
              text: `We didn't find anything about "${articleSummary}" :(`,
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
