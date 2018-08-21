import React, { Component } from 'react';
import { HashRouter, Route } from 'react-router-dom';
import About from './About/About';
import Guide from './About/Guide';
import Editor from './Editor/Editor';
import Login from './User/Login';
import Profile from './User/Profile';
import Navigation from './Navigation/Navigation';
import theUserService from '../Services/UserService';

class App extends Component {
  constructor(props) {
    super(props);

    this.state = {
      isOpen: false,
      user: {}
    };
  }

  componentDidMount() {
    theUserService.subscribe(this.onUpdateUser);
  }

  componentWillUnmount() {
    theUserService.unsubscribe(this.onUpdateUser)
  }

  onUpdateUser = (user) => {
    this.setState({
      user: user
    });
  };

  onToggleDialog = () => {
    this.setState({
      isOpen: !this.state.isOpen
    });
  };

  render() {
    return (
      <HashRouter>
        <div>
          <Navigation user={this.state.user} />
          <Route exact path="/" component={About}></Route>
          <Route exact path="/Guide" component={Guide}></Route>
          <Route exact path="/Editor" component={Editor}></Route>
          <Route exact path="/Login" component={Login}></Route>
          <Route exact path="/Profile" render={props => (
            <Profile user={this.state.user}/>
          )}>
          </Route>
        </div>
      </HashRouter>
    );
  }
}

export default App;
