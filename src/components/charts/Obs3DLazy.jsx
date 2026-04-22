import React, { forwardRef } from "react";
import { Obs3D } from "./Obs3D.jsx";

export default forwardRef(function Obs3DLazy(props, ref) {
  return <Obs3D {...props} ref={ref} />;
});

