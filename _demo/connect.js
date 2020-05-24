import { use, connect } from '../src/index';

import { one } from "./stores";
import { MyComponent } from "./components";

// use defined store
use(one);

// create mapToProps function
const mapToProps = stores => {
  const { one } = stores;
  return {
    one
  };
};

// connect store and component with mapToProps
export default connect(mapToProps)(MyComponent);
