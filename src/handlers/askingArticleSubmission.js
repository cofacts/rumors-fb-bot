import { t } from 'ttag';
import gql from '../gql';
import ga from '../ga';
import { getArticleURL } from './utils';

/**
 * The state that a user has decided whether to submit a new article.
 */
export default async function askingArticleSubmission(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  if (!data.searchedText) {
    throw new Error('searchText not set in data');
  }

  const visitor = ga('FB-' + userId, data.searchedText);
  visitor.screenview({ screenName: state });

  if (event.input === 'y') {
    // Track whether user create Article or not if the Article is not found in DB.
    visitor.event({ ec: 'Article', ea: 'Create', el: 'Yes' });

    const reason = data.reasonText;
    const {
      data: { CreateArticle },
    } = await gql`
      mutation($text: String!, $reason: String!) {
        CreateArticle(text: $text, reason: $reason, reference: { type: FB }) {
          id
        }
      }
    `({ text: data.searchedText, reason }, { userId });

    const articleUrl = getArticleURL(CreateArticle.id);
    replies = [
      {
        type: 'text',
        content: {
          text: t`Your submission is now recorded at ${articleUrl}`,
        },
      },
      { type: 'text', content: { text: t`Thank you` } },
    ];
    state = '__INIT__';
  } else if (event.input === 'n') {
    // Track whether user create Article or not if the Article is not found in DB.
    visitor.event({ ec: 'Article', ea: 'Create', el: 'No' });

    replies = [
      {
        type: 'text',
        content: { text: t`The message is discarded. Thank you.` },
      },
    ];
    state = '__INIT__';
  } else if (event.input === 'r') {
    replies = [
      {
        type: 'text',
        content: { text: t`Sure. Please revise your reason.` },
      },
    ];
    state = 'ASKING_ARTICLE_SUBMISSION_REASON';
  }

  visitor.send();
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
