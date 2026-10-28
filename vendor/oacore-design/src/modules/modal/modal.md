## Accessible Modal

Modal is built according to [Modal Dialog Example from WAI ARIA practices](https://www.w3.org/TR/wai-aria-practices-1.1/examples/dialog-modal/dialog.html).
When modal is open focus is trapped withing the modal's focusable nodes.
The dialog can be closed automatically (by hitting ESC key or clicking outside of content area) or manually.
Focus is restored after dialog is closed.


```jsx
import React from 'react'

import Modal from './modal'
import { Button } from '../../elements'

const DemoOne = () => {
  const [isModalActive, setModalActive] = React.useState(false)
  const modal = isModalActive ? (
    <Modal
      aria-label="Demo One modal"
      onClose={() => setModalActive(false)}
    >
      <Modal.Title>Demo One</Modal.Title> 
      <Modal.Content tag="p">
        Modal gets closed automatically on overlay click, by hitting ESC key, or by clicking on button.     
      </Modal.Content>
      <Modal.Footer>
        <Button
          onClick={() => setModalActive(false)}
          variant="contained"        
        >
          Close me!
        </Button>
      </Modal.Footer> 
    </Modal>
  ) : null

  return (
    <p>
      <Button
        variant="contained"
        onClick={() => setModalActive(true)}
      >
        Show auto closable modal
      </Button>
      {modal}
    </p>
  )
}

const DemoTwo = () => {
  const [isModalActive, setModalActive] = React.useState(false)
  const modal = isModalActive ? (
    <Modal
      aria-labelledby="modal-title-2"
      hideManually
    >
      <Modal.Title
         id="modal-title-2"
      >
            Demo Two
      </Modal.Title> 
      <Modal.Content tag="p">
        Modal gets hidden only by clicking on button.     
      </Modal.Content>
      <Modal.Footer>
        <Button
          onClick={() => setModalActive(false)}
          variant="contained"        
        >
          Close me!
        </Button>
      </Modal.Footer> 
    </Modal>
  ) : null

  return (
    <p>
      <Button
        variant="contained"
        onClick={() => setModalActive(true)}
      >
        Show manually closable modal
      </Button>
      {modal}
    </p>
  )
}

const DemoThree = () => {
  const [isModalActive, setModalActive] = React.useState(false)
  const modal = isModalActive ? (
    <Modal
      aria-labelledby="modal-title-3"
      onClose={() => setModalActive(false)}
    >
      <Modal.Title
         id="modal-title-3"
      >
            Demo Three
      </Modal.Title> 
      <Modal.Content>
        <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis, massa eget ornare bibendum, nulla est porta tellus, eget malesuada leo augue vel ligula. Praesent blandit nisi id enim ultrices, quis gravida sapien pretium. Donec bibendum augue eu lacus dapibus consectetur. Vestibulum fringilla turpis sed tortor dapibus, sit amet commodo ante interdum. Duis bibendum at lacus non volutpat. Proin at lacinia massa, a fermentum metus. Proin at tortor ac justo vehicula iaculis. Praesent sollicitudin dui leo. Cras ac tortor nec nisl gravida porta. Quisque gravida magna sed risus auctor, sed fermentum risus suscipit. Fusce cursus nisi sed ipsum tristique, feugiat tempus lorem eleifend. Curabitur non venenatis justo. Maecenas massa diam, varius quis dolor eu, mollis posuere erat. Phasellus neque diam, mollis ut venenatis at, molestie porttitor nisi. Morbi sed ex libero.
        </p>
        <p>
            Nam varius tincidunt hendrerit. Ut dictum molestie lorem eu placerat. Mauris at ex et nibh volutpat ullamcorper. Donec sit amet diam velit. Aenean at ante non massa scelerisque vehicula. Nunc scelerisque neque sem, non tincidunt nulla molestie et. Nulla at pharetra turpis. Vestibulum aliquam elit id erat malesuada, ut tempus elit rhoncus. Suspendisse sit amet tristique ante. Quisque volutpat pretium sagittis. In accumsan, arcu fringilla venenatis suscipit, elit leo consequat tortor, sit amet consequat est dolor sit amet neque. Curabitur accumsan augue enim, in egestas felis placerat et.
        </p>
        <p>
            Nulla consectetur auctor dignissim. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Quisque eu pulvinar libero, nec cursus leo. Maecenas maximus, urna laoreet tincidunt laoreet, lorem nulla aliquet justo, id scelerisque dui libero a lectus. Mauris quis felis ac orci tempus tempus. Fusce blandit bibendum mi, eu maximus quam sodales quis. Morbi nec luctus nisl. Maecenas suscipit placerat gravida. Morbi viverra magna non risus lobortis, at sodales enim consequat. Vivamus fringilla dignissim quam, id euismod turpis blandit eget.
        </p>
        <p>
            Praesent id orci ac nunc sollicitudin facilisis. Fusce et fringilla metus, a accumsan enim. Ut consectetur est ac ante consequat laoreet. Praesent vitae eros eleifend, congue tellus at, maximus nunc. Vestibulum sed nunc id risus volutpat volutpat. Pellentesque vehicula, metus sed efficitur accumsan, lacus dui commodo turpis, sed consectetur tellus neque non sem. Ut pellentesque enim ut sodales sagittis. In mi lorem, finibus fringilla efficitur vel, ultricies eget erat.
        </p>
        <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis, massa eget ornare bibendum, nulla est porta tellus, eget malesuada leo augue vel ligula. Praesent blandit nisi id enim ultrices, quis gravida sapien pretium. Donec bibendum augue eu lacus dapibus consectetur. Vestibulum fringilla turpis sed tortor dapibus, sit amet commodo ante interdum. Duis bibendum at lacus non volutpat. Proin at lacinia massa, a fermentum metus. Proin at tortor ac justo vehicula iaculis. Praesent sollicitudin dui leo. Cras ac tortor nec nisl gravida porta. Quisque gravida magna sed risus auctor, sed fermentum risus suscipit. Fusce cursus nisi sed ipsum tristique, feugiat tempus lorem eleifend. Curabitur non venenatis justo. Maecenas massa diam, varius quis dolor eu, mollis posuere erat. Phasellus neque diam, mollis ut venenatis at, molestie porttitor nisi. Morbi sed ex libero.
        </p>
        <p>
            Nam varius tincidunt hendrerit. Ut dictum molestie lorem eu placerat. Mauris at ex et nibh volutpat ullamcorper. Donec sit amet diam velit. Aenean at ante non massa scelerisque vehicula. Nunc scelerisque neque sem, non tincidunt nulla molestie et. Nulla at pharetra turpis. Vestibulum aliquam elit id erat malesuada, ut tempus elit rhoncus. Suspendisse sit amet tristique ante. Quisque volutpat pretium sagittis. In accumsan, arcu fringilla venenatis suscipit, elit leo consequat tortor, sit amet consequat est dolor sit amet neque. Curabitur accumsan augue enim, in egestas felis placerat et.
        </p>
        <p>
            Nulla consectetur auctor dignissim. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Quisque eu pulvinar libero, nec cursus leo. Maecenas maximus, urna laoreet tincidunt laoreet, lorem nulla aliquet justo, id scelerisque dui libero a lectus. Mauris quis felis ac orci tempus tempus. Fusce blandit bibendum mi, eu maximus quam sodales quis. Morbi nec luctus nisl. Maecenas suscipit placerat gravida. Morbi viverra magna non risus lobortis, at sodales enim consequat. Vivamus fringilla dignissim quam, id euismod turpis blandit eget.
        </p>
        <p>
            Praesent id orci ac nunc sollicitudin facilisis. Fusce et fringilla metus, a accumsan enim. Ut consectetur est ac ante consequat laoreet. Praesent vitae eros eleifend, congue tellus at, maximus nunc. Vestibulum sed nunc id risus volutpat volutpat. Pellentesque vehicula, metus sed efficitur accumsan, lacus dui commodo turpis, sed consectetur tellus neque non sem. Ut pellentesque enim ut sodales sagittis. In mi lorem, finibus fringilla efficitur vel, ultricies eget erat.
        </p>
        <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer facilisis, massa eget ornare bibendum, nulla est porta tellus, eget malesuada leo augue vel ligula. Praesent blandit nisi id enim ultrices, quis gravida sapien pretium. Donec bibendum augue eu lacus dapibus consectetur. Vestibulum fringilla turpis sed tortor dapibus, sit amet commodo ante interdum. Duis bibendum at lacus non volutpat. Proin at lacinia massa, a fermentum metus. Proin at tortor ac justo vehicula iaculis. Praesent sollicitudin dui leo. Cras ac tortor nec nisl gravida porta. Quisque gravida magna sed risus auctor, sed fermentum risus suscipit. Fusce cursus nisi sed ipsum tristique, feugiat tempus lorem eleifend. Curabitur non venenatis justo. Maecenas massa diam, varius quis dolor eu, mollis posuere erat. Phasellus neque diam, mollis ut venenatis at, molestie porttitor nisi. Morbi sed ex libero.
        </p>
        <p>
            Nam varius tincidunt hendrerit. Ut dictum molestie lorem eu placerat. Mauris at ex et nibh volutpat ullamcorper. Donec sit amet diam velit. Aenean at ante non massa scelerisque vehicula. Nunc scelerisque neque sem, non tincidunt nulla molestie et. Nulla at pharetra turpis. Vestibulum aliquam elit id erat malesuada, ut tempus elit rhoncus. Suspendisse sit amet tristique ante. Quisque volutpat pretium sagittis. In accumsan, arcu fringilla venenatis suscipit, elit leo consequat tortor, sit amet consequat est dolor sit amet neque. Curabitur accumsan augue enim, in egestas felis placerat et.
        </p>
        <p>
            Nulla consectetur auctor dignissim. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Quisque eu pulvinar libero, nec cursus leo. Maecenas maximus, urna laoreet tincidunt laoreet, lorem nulla aliquet justo, id scelerisque dui libero a lectus. Mauris quis felis ac orci tempus tempus. Fusce blandit bibendum mi, eu maximus quam sodales quis. Morbi nec luctus nisl. Maecenas suscipit placerat gravida. Morbi viverra magna non risus lobortis, at sodales enim consequat. Vivamus fringilla dignissim quam, id euismod turpis blandit eget.
        </p>
        <p>
            Praesent id orci ac nunc sollicitudin facilisis. Fusce et fringilla metus, a accumsan enim. Ut consectetur est ac ante consequat laoreet. Praesent vitae eros eleifend, congue tellus at, maximus nunc. Vestibulum sed nunc id risus volutpat volutpat. Pellentesque vehicula, metus sed efficitur accumsan, lacus dui commodo turpis, sed consectetur tellus neque non sem. Ut pellentesque enim ut sodales sagittis. In mi lorem, finibus fringilla efficitur vel, ultricies eget erat.
        </p>
      </Modal.Content>
      <Modal.Footer>
        <Button
          onClick={() => setModalActive(false)}
          variant="contained"        
        >
          Close me!
        </Button>
      </Modal.Footer> 
    </Modal>
  ) : null

  return (
    <p>
      <Button
        variant="contained"
        onClick={() => setModalActive(true)}
      >
        Show modal with scrollable content
      </Button>
      {modal}
    </p>
  )
}


const MultipleModals = () => {
  const [isModal1Active, setModal1Active] = React.useState(false)
  const [isModal2Active, setModal2Active] = React.useState(false)

  const modal1 = isModal1Active ? (
    <Modal
      aria-labelledby="multiple-modal-title-1"
      onClose={() => setModal1Active(false)}
    >
      <Modal.Title
         id="multiple-modal-title-1"
      >
            Modal 1
      </Modal.Title> 
      <Modal.Content>
        When you click on <b>Show modal 2</b> button focus is trapped within <b>Modal 2</b><br/>
        When you click on <b>Close me!</b> button focus is returned back to initial button.
      </Modal.Content>
      <Modal.Footer>
        <Button
          onClick={() => setModal2Active(true)}
          variant="contained" 
          style={{ marginRight: '1rem' }}
        >
          Show modal 2
        </Button>
        <Button
          onClick={() => setModal1Active(false)}
          variant="contained"        
        >
          Close me! 
        </Button>
      </Modal.Footer> 
    </Modal>
  ) : null

  const modal2 = isModal2Active ? (
    <Modal
      aria-labelledby="multiple-modal-title-2"
      onClose={() => setModal2Active(false)}
    >
      <Modal.Title
         id="multiple-modal-title-2"
      >
            Modal 2
      </Modal.Title> 
      <Modal.Content tag="p">
        When you click on <b>Close me!</b> button focus is returned back to <b>Modal 1</b><br/>
        When you click on <b>Close all</b> button focus is returned back to initial button*.<br/>
        
        * Note that focus is not returned correcly because of
        <a 
            href="https://github.com/theKashey/react-focus-lock/issues/126"
            target="_blank"
            rel="noopener">
                upstream bug
        </a>.

      </Modal.Content>
      <Modal.Footer>
        <Button
          onClick={() => {
            setModal2Active(false)
            setModal1Active(false)
          }}
          variant="contained"       
          style={{ marginRight: '1rem' }}       
        >
          Close all modals
        </Button>
        <Button
          onClick={() => setModal2Active(false)}
          variant="contained"  
        >
          Close me! 
        </Button>
      </Modal.Footer> 
    </Modal>
  ) : null



  return (
    <p>
      <Button
        variant="contained"
        onClick={() => setModal1Active(true)}
      >
        Multiple modals example
      </Button>
      {modal1}
      {modal2}
    </p>
  )
}



<>
  <DemoOne/>
  <DemoTwo/>
  <DemoThree/>
  <MultipleModals />
</>
```
