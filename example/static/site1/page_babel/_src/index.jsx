import React from 'react';
import ReactDOM from 'react-dom';
import dayjs from 'dayjs';

class HelloMessage extends React.Component {
  render() {
    const time = dayjs().format('{YYYY} MM-DDTHH:mm:ss SSS [Z] A');
    return (
      <div>
        <div>Привет, {this.props.name}</div>
        <div>{time}</div>
      </div>
    );
  }
}

ReactDOM.render(<HelloMessage name="Саша" />, document.getElementById('root'));
