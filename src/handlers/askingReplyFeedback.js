import { t, ngettext, msgid } from 'ttag';
import gql from '../gql';
import ga from '../ga';
import {
  getArticleURL,
  createPostbackAction,
  createTypeWords,
  ellipsis,
} from './utils';

/**
 * The state that user has given feedback about the article and replies we displayed.
 * We ask them to send other people our replies if they're satisfied or tell us why
 * they think the replies are not useful.
 */
export default async function askingReplyFeedback(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.selectedReplyId) {
    throw new Error('selectedReply not set in data');
  }

  const visitor = ga('FB-' + userId, data.selectedArticleText);
  visitor.screenview({ screenName: state });

  // Track when user give feedback.
  visitor.event({
    ec: 'UserInput',
    ea: 'Feedback-Vote',
    el: `${data.selectedArticleId}/${data.selectedReplyId}`,
  });

  if (event.input === 'y') {
    const {
      data: {
        action: { feedbackCount },
      },
    } = await gql`
      mutation($vote: FeedbackVote!, $articleId: String!, $replyId: String!) {
        action: CreateOrUpdateArticleReplyFeedback(
          vote: $vote
          articleId: $articleId
          replyId: $replyId
        ) {
          feedbackCount
        }
      }
    `(
      {
        articleId: data.selectedArticleId,
        replyId: data.selectedReplyId,
        vote: 'UPVOTE',
      },
      { userId }
    );
    const {
      data: { GetReply },
    } = await gql`
      query($replyId: String!) {
        GetReply(id: $replyId) {
          type
          text
          reference
        }
      }
    `({
      replyId: data.selectedReplyId,
    });

    const articleUrl = getArticleURL(data.selectedArticleId);

    // FIXME: A string is used for length here because of the need of i18n.
    // The ideal length of ellipsis displayed may differ depending on the language.
    // For example, chinese characters are wider so we need a shorter length.
    const ellipsisLength = 30;
    const content = ellipsis(data.selectedArticleText, ellipsisLength);
    const contentType = createTypeWords(GetReply.type);
    const sharedContent = {
      title: t`Hey someone else says “${content}” is ${contentType}!`,
      subtitle: t`Please refer to ${articleUrl} for other replies to this message and references!`,
      buttons: [
        {
          type: 'web_url',
          url: articleUrl,
          title: t`See other replies`,
        },
      ],
    };

    const otherFeedbackCount = feedbackCount - 1;
    replies = [
      {
        type: 'text',
        content: {
          text:
            otherFeedbackCount > 0
              ? ngettext(
                  msgid`We've received feedback from you and ${otherFeedbackCount} other user!`,
                  `We've received feedback from you and ${otherFeedbackCount} other users!`,
                  otherFeedbackCount
                )
              : t`Thanks. You're the first one who gave feedback on this reply!`,
        },
      },
      {
        type: 'generic',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text:
                '📲 ' +
                t`Don't forget to forward the messages above to others and share with them!` +
                '\n💁 ' +
                t`And feel free to submit your own reply if you have anything to say about this!`,
              buttons: [
                {
                  type: 'element_share',
                  share_contents: {
                    attachment: {
                      type: 'template',
                      payload: {
                        template_type: 'generic',
                        elements: [sharedContent],
                      },
                    },
                  },
                },
                {
                  type: 'web_url',
                  url: articleUrl,
                  title: t`Submit a new reply`,
                },
              ],
            },
          },
        },
      },
    ];

    state = '__INIT__';
    visitor.send();
    return { data, state, event, issuedAt, userId, replies, isSkipUser };
  } else if (event.input === 'n') {
    replies = [
      {
        type: 'buttons',
        content: {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: t`Why do you find this reply not helpful? Please tell us in messages. If you want to skip this, click the skip button below.`,
              buttons: [createPostbackAction(t`Skip`, 'n')],
            },
          },
        },
      },
    ];

    state = 'ASKING_NOT_USEFUL_FEEDBACK';
    visitor.send();
  } else {
    replies = [];
  }
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
