import { Injectable } from '@angular/core';
import {BehaviorSubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class SubscribeService {
  hide$ = new BehaviorSubject<any>(null);

  removeHide$ = new BehaviorSubject<any>(null);

  constructor() { }
}
