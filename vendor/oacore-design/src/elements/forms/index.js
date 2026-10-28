import Form from './form'
import FormControl from './control'
import FormLabel from './label'
import FormGroup from './group'
import FormAddon from './addon'
import TextField from './text-field'

Object.assign(Form, {
  Control: FormControl,
  Label: FormLabel,
  Group: FormGroup,
  Addon: FormAddon,
})

export { Form, TextField }
