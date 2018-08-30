import * as Utils from '../Common/Utils';
import Edge from './Edge';
import Port from './Port';

class Node {
  static categories = {
    GRAPH: 'graph',
    KERNEL: 'kernel'
  };

  constructor(title=null, identifier=null, name=null,
              category=Node.categories.GRAPH) {
    this.title = title;
    this.name = name;
    this.identifier = identifier;
    this.public = false;
    this.category = category;
    this.id = Utils.generateUID();
    this.position = {x: 0, y: 0};
    this.inputs = [];
    this.outputs = [];
    this.attributes = [];
    this.nodeData = [];
    this.edgeData = [];
    this.code = '';
  }

  uniqueName(name) {
    return Utils.uniqueName(name, this.nodeData.map(d => d.name));
  }

  clone() {
    let d = new Node();
    d.title = this.title;
    d.name = this.name;
    d.identifier = this.identifier;
    d.public = this.public;
    d.category = this.category;
    d.id = this.id;
    d.position = Utils.clone(this.position);
    d.inputs = Utils.clone(this.inputs);
    d.outputs = Utils.clone(this.outputs);
    d.attributes = Utils.clone(this.attributes);
    d.nodeData = [];
    for (let node of this.nodeData) {
      node = Object.assign(new Node(), node).clone()
      d.nodeData.push(node);
    }
    d.edgeData = [];
    for (let edge of this.edgeData) {
      edge = Object.assign(new Edge(), edge).clone()
      d.edgeData.push(edge);
    }
    d.code = this.code;
    return d;
  }

  fromTemplate(template, pos) {
    let d = Object.assign(new Node(), template).clone();
    d.name = this.uniqueName(d.identifier);
    d.position = pos;
    for (let side of ['inputs', 'outputs']) {
      for (let i in d[side]) {
        d[side][i].id = new Port(d.id, side, i).id;
        d[side][i].alias = '';
      }
    }
    for (let attr of d.attributes) {
      attr.alias = '';
    }
    return d;
  }

  toTemplate() {
    let d = this.clone();
    delete d.id;
    delete d.name;
    delete d.position;
    for (let side of ['inputs', 'outputs']) {
      for (let i in d[side]) {
        delete d[side][i].id;
        delete d[side][i].alias;
      }
    }
    for (let attr of d.attributes) {
      delete attr.alias;
    }
    return d;
  }

  addNode(d) {
    this.nodeData.push(d);
  }

  removeNode(nodeDatum) {
    let nodeId = nodeDatum.id;
    let i = this.edgeData.length;
    while (i--) {
      let d = this.edgeData[i];
      if (Port.fromId(d.source).nodeId === nodeId ||
        Port.fromId(d.target).nodeId === nodeId) {
        this.edgeData.splice(i, 1);
      }
    }

    let nodeIdx = this.nodeData.indexOf(nodeDatum);
    this.nodeData.splice(nodeIdx, 1);
  }

  pathExists(srcId, tarId) {
    try {
      let p = Port.fromId(srcId);
      let node = this.getNodeById(p.nodeId);
      if (node.outputs.find(d => d.id === tarId)) {
        return true;
      }
      for (let q of node.outputs) {
        let edges = this.edgeData.filter(edge => edge.source === q.id);
        for (let edge of edges) {
          if (this.pathExists(edge.target, tarId)) {
            return true;
          }
        }
      }
    } catch(err) { }
    return false;
  }

  addEdge(srcId, tarId) {
    if (this.pathExists(tarId, srcId)) {
      return false;
    }
    let d = new Edge(srcId, tarId);
    let edgeId = d.id;
    if (this.getEdgeById(edgeId) !== undefined) {
      return;
    }
    this.edgeData.push(d);
    return true;
  }

  removeEdge(edgeDatum) {
    let edgeIdx = this.edgeData.indexOf(edgeDatum);
    this.edgeData.splice(edgeIdx, 1);
  }

  getNodeById(nodeId) {
    return this.nodeData.find(d => d.id === nodeId);
  }

  getEdgeById(edgeId) {
    return this.edgeData.find(d => d.id === edgeId);
  }

  getPortById(portId) {
    let p = Port.fromId(portId);
    let node = this.getNodeById(p.nodeId);
    return node[p.side][p.idx];
  }

  getPortEdges(portId) {
    let p = Port.fromId(portId);
    let ts = {inputs: 'target', outputs: 'source'}[p.side];
    return this.edgeData.filter(edge => edge[ts] === portId);
  }

  pruneEdges() {
    let ports = new Set();
    for (let node of this.nodeData) {
      for (let side of ['inputs', 'outputs']) {
        for (let port of node[side]) {
          ports.add(port.id);
        }
      }
    }
    this.edgeData = this.edgeData.filter(function(edge) {
      return ports.has(edge.source) && ports.has(edge.target);
    });
  }

  updatePorts() {
    let ports = {inputs: [],  outputs: []};
    let idx = {inputs: 0, outputs: 0}
    this.nodeData.forEach(function(node) {
      for (let side of ['inputs', 'outputs']) {
        for (let i in node[side]) {
          let port = node[side][i];
          if (port.alias) {
            ports[side].push({
              name: port.alias,
              id: new Port(this.id, side, idx[side]++).id,
              alias: null
            });
          }
        }
      }
    }.bind(this));
    this.inputs = ports.inputs;
    this.outputs = ports.outputs;
  }

  updateAttributes() {
    let attributes = [];
    this.nodeData.forEach(function(node) {
      for (let attr of node.attributes) {
        if (attr.alias) {
          attributes.push({
            name: attr.alias,
            value: attr.value,
            alias: null
          });
        }
      }
    });
    this.attributes = attributes;
  }

  updateFromConfig(config) {
    this.inputs = config.inputs;
    this.outputs = config.outputs;
    this.attributes = config.attributes;
  }

  setPortAlias(port, alias) {
    port.alias = alias;
    this.updatePorts();
  }

  setAttributeAlias(attr, alias) {
    attr.alias = alias;
    this.updateAttributes();
  }

  defineKernel(sandbox) {
    let code = `
    window.def_${this.identifier} = function() {
      ${this.code}
    }();`;
    return sandbox.eval(code);
  }

  updateFromCode(sandbox) {
    return this.defineKernel(sandbox).then(() => {
      let code = `return window.def_${this.identifier}.config`;
      return sandbox.call(code);
    }).then(config => {
      this.updateFromConfig(config);
    });
  }

  async run(sandbox) {
    let visited = new Set();
    for (let node of this.nodeData) {
      await this.createNode(node, visited, sandbox);
    }
  }

  async createNode(node, visited, sandbox) {
    if (visited.has(node.id)) return;
    visited.add(node.id);

    if (node.category === Node.categories.KERNEL) {
      await node.defineKernel(sandbox);
    }

    // Set the input args
    let inputArgs = [];
    let scopeArgs = [
      `window.in_${node.id}={}`,
      `window.at_${node.id}={}`
    ];
    for (let inPort of node.inputs) {
      let argVals = [];
      for (let edge of this.getPortEdges(inPort.id)) {
        let sourcePort = Port.fromId(edge.source);
        let sourceNode = this.getNodeById(sourcePort.nodeId);
        let sourcePortName = sourceNode[sourcePort.side][sourcePort.idx].name;
        await this.createNode(sourceNode, visited, sandbox);
        argVals.push(`window.out_${sourceNode.id}.${sourcePortName}`);
      }
      if (inPort.alias) {
        argVals.push(`...window.in_${this.id}.${inPort.alias}`);
      }
      inputArgs.push(`${inPort.name}=[${argVals.join(',')}]`);
      scopeArgs.push(`window.in_${node.id}.${inPort.name}=[${argVals.join(',')}]`);
    }

    // Set the attributes
    for (let attr of node.attributes) {
      let value;
      if (attr.alias) {
        value = `window.at_${this.id}.${attr.alias}`;
      } else {
        value = `${attr.value}`;
      }
      inputArgs.push(`${attr.name}=${value}`);
      scopeArgs.push(`window.at_${node.id}.${attr.name}=${value}`);
    }

    // Run the subgraph
    if (node.category === Node.categories.KERNEL) {
      let code = `
      window.out_${node.id} = window.def_${node.identifier}.call(
        ${inputArgs.join(',')});`;
      await sandbox.eval(code);
    } else {
      let code = `${scopeArgs.join(';')}`;
      await sandbox.eval(code);
      await node.run(sandbox);
    }
  }
}

export default Node;
