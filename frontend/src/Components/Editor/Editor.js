import React, { Component } from 'react';
import GraphEditor from './GraphEditor'
import CodeEditor from './CodeEditor'
import Menu from './Menu'
import TabsBar from './TabsBar';
import { NewDialog, OpenDialog, SaveDialog, DeleteDialog, MessageDialog } from './Dialogs';
import theCatalogService from '../../Services/CatalogService'
import Node from '../../Graph/Node';
import * as Utils from '../../Common/Utils';
import './Editor.css';

const modes = {
  NONE: 'none',
  GRAPH: 'graph',
  CODE: 'code'
};

class Editor extends Component {
  constructor(props) {
    super(props);

    let scope = new Node('New Project', 'project0');
    this.state = {
      scope: scope,
      openNodes: [scope]
    };
  }

  componentDidMount() {
    this.setState({});
  }

  get mode() {
    if (this.state.scope === null) {
      return modes.NONE;
    } else if (this.state.scope.category === Node.categories.GRAPH) {
      return modes.GRAPH;
    } else {
      return modes.CODE;
    }
  }

  uniqueIdentifier(identifier) {
    let identifiers = this.state.openNodes.map(d => d.identifier).concat(
      theCatalogService.getIdentifiers(Node.categories.GRAPH));
    return Utils.uniqueName(identifier, identifiers);
  }

  onNew = () => {
    this.newDialog.open(
      {
        graph: 'Graph',
        kernel: 'Kernel'
      },
      (category) => {
        this.onNewSubgraph(category);
      },
      () => {});
  };

  onNewSubgraph = (category = Node.categories.GRAPH) => {
    let node = new Node('New Project', this.uniqueIdentifier('project'));
    node.category = category;
    let openNodes = this.state.openNodes;
    openNodes.push(node);
    this.setState({
      scope: node,
      openNodes: openNodes
    });
  };

  onOpen = () => {
    this.openDialog.open(
      theCatalogService.getIdentifiers(Node.categories.GRAPH),
      (identifier) => {
        let p = theCatalogService.getItemByIdentifier(
          Node.categories.GRAPH, identifier);
        p = Object.assign(new Node(), p).clone();
        this.onOpenSubgraph(p);
      },
      () => {});
  };

  onOpenSubgraph = (p) => {
    let openNodes = this.state.openNodes;
    let i = openNodes.findIndex(q => q.identifier === p.identifier);
    if (i >= 0) {
      openNodes.splice(i, 1);
    }
    openNodes.push(p);
    if (this.state.scope !== null) {
      this.state.scope.pruneEdges();
    }
    this.setState({
      scope: p,
      openNodes: openNodes
    });
  };

  onClose = (p) => {
    if (p === null) {
      this.messageDialog.open('Error', 'Invalid action.');
      return;
    }
    let openNodes = this.state.openNodes;
    let i = openNodes.indexOf(p);
    openNodes.splice(i, 1);
    this.setState({openNodes: openNodes});
    if (this.state.scope === p) {
      if (openNodes.length === 0) {
        this.onSetScope(null);
      } else {
        this.onSetScope(openNodes[Math.max(0, i - 1)]);
      }
      return;
    }
  };

  onSave = (p=null, onOK=null, onCancel=null) => {
    if (p === null) {
      p = this.state.scope;
      if (p === null) {
        this.messageDialog.open('Error', 'Invalid action.');
        return;
      }
    }

    this.saveDialog.open(
      p.title,
      p.identifier,
      new Set(theCatalogService.getIdentifiers(Node.categories.GRAPH)),
      (title, identifier) => {
        p.title = title;
        p.identifier = identifier;
        theCatalogService.add(Node.categories.GRAPH, p.toTemplate(), () => {
          this.messageDialog.open(
            'Error', 'Failed to communicate with the server. '+
            'Perhaps you are not logged in?');
        });
        if (onOK) onOK();
        this.setState({scope: p});
      },
      () => {
        if (onCancel) onCancel();
      });
  };

  onDelete = () => {
    if (this.state.scope === null) {
      this.messageDialog.open('Error', 'Invalid action.');
      return;
    }
    let existing = theCatalogService.getItemByIdentifier(
      Node.categories.GRAPH, this.state.scope.identifier);
    if (!existing) {
      let p = this.state.scope;
      this.onClose(p);
      return;
    }
    this.deleteDialog.open(
      this.state.scope.identifier,
      () => {
        let p = this.state.scope;
        this.onClose(p);
        theCatalogService.remove(Node.categories.GRAPH, p, () => {
          this.messageDialog.open(
            'Error', 'Failed to communicate with the server. '+
            'Perhaps you are not logged in?');
        });
      },
      () => {}
    );
  };

  onRun = () => {
    if (this.state.scope === null) {
      this.messageDialog.open('Error', 'Invalid action.');
      return;
    }

    let identifier = this.state.scope.identifier;
    if (!theCatalogService.getItemByIdentifier(
        Node.categories.GRAPH, identifier)) {
      this.messageDialog.open(
        'Error', 'Current project is not saved.');
      return;
    }
  };

  onStop = () => {
    if (this.state.scope === null) {
      this.messageDialog.open('Error', 'Invalid action.');
      return;
    }
  };

  onSetScope = (p) => {
    if (this.state.scope !== null) {
      this.state.scope.pruneEdges();
    }
    this.setState({
      scope: p
    });
  }

  onChangeIdentifier = () => {
    this.setState({openNodes: this.state.openNodes});
  }

  render() {
    let callbacks = {
      new: this.onNew,
      open: this.onOpen,
      save: this.onSave,
      delete: this.onDelete,
      run: this.onRun,
      stop: this.onStop,
    };

    return (
      <div id="editor-container">
        <NewDialog ref={p => this.newDialog = p} />
        <OpenDialog ref={p => this.openDialog = p} />
        <SaveDialog ref={p => this.saveDialog = p} />
        <DeleteDialog ref={p => this.deleteDialog = p} />
        <MessageDialog ref={p => this.messageDialog = p} />
        <div className="menu">
          <Menu ref={p => this.menu = p} callbacks={callbacks} />
        </div>
        <div className="tabsBar">
          <TabsBar scope={this.state.scope}
                   openNodes={this.state.openNodes}
                   onSetScope={this.onSetScope}
                   onSaveSubgraph={this.onSave}
                   onCloseSubgraph={this.onClose} />
        </div>
        <div className="editor">
        {
          this.mode === modes.GRAPH &&
          <GraphEditor ref={p => this.editor = p}
                        scope={this.state.scope}
                        onOpenSubgraph={this.onOpenSubgraph} />
        }
        {
          this.mode === modes.CODE &&
          <CodeEditor ref={p => this.editor = p} scope={this.state.scope} />
        }
        </div>
      </div>
    );
  }
}

export default Editor;
