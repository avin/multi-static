import React, { useMemo } from 'react';
import ReactDOM from 'react-dom';
import dayjs from 'dayjs';

interface Props {
  name: string;
}
const HelloMessage = ({ name }: Props): JSX.Element => {
  const time = useMemo(() => dayjs().format('{YYYY} MM-DDTHH:mm:ss SSS [Z] A'), []);

  return (
    <div>
      <div>Привет, {name}</div>
      <div>{time}</div>
    </div>
  );
};

ReactDOM.render(<HelloMessage name="Саша" />, document.getElementById('root'));
