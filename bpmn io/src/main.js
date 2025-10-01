import './polyfills.js';

const diagramUrl = 'https://cdn.statically.io/gh/bpmn-io/bpmn-js-examples/dfceecba/starter/diagram.bpmn';

const bpmnModeler = new window.BpmnJS({
  container: '#canvas'
});

async function exportDiagram() {
  try {
    const result = await bpmnModeler.saveXML({ format: true });

    window.alert('Diagram exported. Check the developer tools!');
    window.console.log('DIAGRAM', result.xml);
  } catch (err) {
    window.console.error('could not save BPMN 2.0 diagram', err);
  }
}

async function openDiagram(bpmnXML) {
  try {
    await bpmnModeler.importXML(bpmnXML);

    const canvas = bpmnModeler.get('canvas');
    const overlays = bpmnModeler.get('overlays');

    canvas.zoom('fit-viewport');

    overlays.add('SCAN_OK', 'note', {
      position: {
        bottom: 0,
        right: 0
      },
      html: '<div class="diagram-note">Mixed up the labels?</div>'
    });

    canvas.addMarker('SCAN_OK', 'needs-discussion');
  } catch (err) {
    window.console.error('could not import BPMN 2.0 diagram', err);
  }
}

window.$.get(diagramUrl, openDiagram, 'text');
window.$('#save-button').click(exportDiagram);
