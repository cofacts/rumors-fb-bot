import { t } from 'ttag';
/**
 * the state that indicates we don't understand user input and ask them to retry
 */
export default function defaultState(params) {
  let { data, state, event, issuedAt, userId, replies, isSkipUser } = params;

  replies = [
    {
      type: 'text',
      content: {
        // Sorry I don't understand :(
        // Please try again
        text: t`Sorry I don't understand :(\nPlease try again.`,
      },
    },
  ];
  state = '__INIT__';
  return { data, state, event, issuedAt, userId, replies, isSkipUser };
}
